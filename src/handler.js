'use strict';

const Rekognition = require('aws-sdk/clients/rekognition');
// const DynamoDB = require('aws-sdk/clients/dynamodb');
const Moderation = require('./models/moderation');
const mongoose = require('mongoose');

module.exports.startProcessingVideo = async (event, context) => {
  // loop through objects
  for (let record of event.Records) {
    const { bucket, object } = record.s3;

    await startLabelDetection(bucket.name, object.key.replace(/\+/g, ' '));
  }

  return;

  // ############################################################
  async function startLabelDetection(bucketName, objectKey) {
    const rekognition = new Rekognition({ apiVersion: 'latest' });

    const { JobId } = await rekognition
      .startLabelDetection({
        Video: { S3Object: { Bucket: bucketName, Name: objectKey } },
        MinConfidence: 80,
        NotificationChannel: {
          SNSTopicArn: process.env.VIDEO_PROCESSED_SNSTOPIC_ARN,
          RoleArn: process.env.REKOGNITION_PUBLISH_SNSTOPIC_ROLE_ARN,
        },
      })
      .promise();

    console.log(`Rekognition JobId: ${JobId}`);
  }
};

module.exports.handleProcessedVideo = async (event, context) => {
  // loop through all processed videos
  for (let record of event.Records) {
    const {
      Sns: { Message },
    } = record;

    const message = JSON.parse(Message);
    const labels = await getLabelDetection(message.JobId);

    await putLabelsInMongoDB(
      message.Video.S3Bucket,
      message.Video.S3ObjectName,
      labels
    );

    // await putLabelsInDynamoDB(
    //   message.Video.S3Bucket,
    //   message.Video.S3ObjectName,
    //   labels
    // );
  }

  // ############################################################
  async function putLabelsInMongoDB(bucketName, objectKey, labels) {
    // Init Database Connection
    mongoose
      .connect(process.env.MONGO_URI)
      .then(() => console.log(`connected to MongoDB`))
      .catch((err) => console.log(err));

    const videoId = objectKey.substr(0, objectKey.indexOf('.'));
    const moderation = new Moderation({
      videoId,
      videoName: objectKey,
      videoBucket: bucketName,
      labels,
    });

    await moderation.save();
  }

  // ############################################################
  // async function putLabelsInDynamoDB(bucketName, objectKey, labels) {
  //   const dynamoDB = new DynamoDB.DocumentClient({ apiVersion: 'latest' });

  //   await dynamoDB
  //     .put({
  //       TableName: process.env.VIDEOS_DYNAMODB_TABLE,
  //       Item: {
  //         videoName: objectKey,
  //         videoBucket: bucketName,
  //         labels,
  //       },
  //     })
  //     .promise();
  // }

  async function getLabelDetection(jobId) {
    const rekognition = new Rekognition({ apiVersion: 'latest' });

    let { Labels: labels, NextToken: nextToken } = await rekognition
      .getLabelDetection({ JobId: jobId })
      .promise();

    while (nextToken) {
      let response = await rekognition
        .getLabelDetection({ JobId: jobId, NextToken: nextToken })
        .promise();

      nextToken = response.NextToken;

      labels.push(response.Labels);
    }

    return labels;
  }
};
