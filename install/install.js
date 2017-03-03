// SET YOUR AWS CREDENTIALS HERE!!!
// If you use a credentials file (recommended!) supply your profile here
// process.env.AWS_PROFILE = '';
//
// Otherwise set your access and secret key below...
// var accessKeyId = "";
// var secretAccessKey = "";

var Promise = require('bluebird');
var AWS = require('aws-sdk');
var config = require('../config');
var archiver = require('archiver');

if (!(process.env.AWS_PROFILE)) AWS.config.update({accessKeyId: accessKeyId, secretAccessKey: secretAccessKey});
var s3 = Promise.promisifyAll(new AWS.S3({apiVersion: '2012-06-01', region: config.aws.region, sslEnabled: true}));
var cf = Promise.promisifyAll(new AWS.CloudFormation({apiVersion: '2010-05-15'}));

function createBucketIfNeeded() {
    console.log("Creating/verifying bucket " + config.aws.s3bucket + " exists and is writable...");
    return s3.headBucketAsync({Bucket: config.aws.s3bucket})
    .then(function(data) {
        return;
    }).catch(function(e) {
        if (e.statusCode == 301)
            throw new Error("Bucket exists already (either in another region  or by another user).  Try another bucket name.");

        if (e.statusCode != 404)
            throw e;

        s3.createBucketAsync({Bucket: config.aws.s3bucket})
        .then(function() {
            return s3.waitForAsync('bucketExists', {Bucket: config.aws.s3bucket});
        })
        .catch(function(e) {
            throw e;
        });
    });
}

function uploadLambda() {
    console.log("Uploading Lambda functions...");
    var output = require('fs').createWriteStream('../wheresmyip.zip');
    var zip = archiver.create('zip', {});
    zip.file('../lambdaweb.js', {name: "lambdaweb.js"});
    zip.file('../config.json', {name: "config.json"});
    zip.directory('../node_modules', 'node_modules');
    var promise = s3.uploadAsync({
        Bucket: config.aws.s3bucket,
        Key: "wheresmyip_lambda.zip",
        Body: zip
    });
    zip.finalize();
    return promise;
}

function runCF() {
    console.log("Running CloudFormation stack...");
    s3.uploadAsync({
        Bucket: config.aws.s3bucket,
        Key: "cf." + config.aws.cfstack + ".json",
        Body: require("fs").createReadStream("cf.json")
    })
    .then(function(file) {
        require('eyes').inspect(file);
        cf.createStack({
            StackName: config.asw.cfstack,
            Capabilities: [
            'CAPABILITY_IAM'
            ],
            StackPolicyURL: file.Location,
            Parameters: [{
              ParameterKey: 'AccountName',
              ParameterValue: 'STRING_VALUE',
              UsePreviousValue: true || false
            },
            ]
        })
    }).catch(function(e) {console.error(e)})
}

createBucketIfNeeded()
//.then(uploadLambda)
.then(runCF);