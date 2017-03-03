var Promise = require('bluebird');
var config = require("./config");
var AWS = require('aws-sdk');
var ip = require('ip-address');
var ddb = Promise.promisifyAll(new AWS.DynamoDB({apiVersion: '2012-08-10', region: config.aws.region}));
var llre = new RegExp("^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$");

function set(event, context) {
    //
    // Detect and validate address (IPv4? IPv6?)
    // Amazon only supports IPv4 endpoints for now, so IPv6 is TODO...  We can move to EC2 and get IPv6 on the ELB...
    // If IPv4, modify to IPv6
    var remoteIP = event.remoteIP;
    var address = new ip.v6.Address(remoteIP);
    if (!(address.isValid())) {
        // Fallback to ipv4
        address = new ip.v4.Address(remoteIP);
        if (!(address.isValid())) {
            context.fail("Bad Request: Uh oh! [" + remoteIP + "] doesn't look like a valid IP address");
            return;
        }
        address = ip.v6.Address.fromAddress4(remoteIP);
    }
    console.log("Identified address " + address.correctForm() + " (" + address.getBits() + ")");
    // TODO: Weed out private address spaces

    // TODO: Weed out well-known NAT endpoints

    // Validate coordinates
    // if (!(llre.test(event.lat) && llre.test(event.lon))) { // why doesn't this work?
    if (!(parseFloat(event.lat) && parseFloat(event.lon))) { // hack :p
        context.fail("Bad Request: Uh oh! [ Lat: " + event.lat + " / Lon: " + event.lon + " ] don't look like valid coordinates");
        return;
    }

    // Add to ddb
    var item = {
        IP: {N: address.getBits().toString()},
        Lat: {S: event.lat},
        Lon: {S: event.lon},
        Updated: {N: Date.now().toString()}
    };

    ddb.putItemAsync({TableName: config.aws.ddbtable, Item: item}).then(function(data) {
        context.succeed(item);
    }).catch(function(e) {
        context.fail("Server Error: " + e);
    });
}

function get(event, context) {
    //
    // Validate address (IPv4? IPv6?)
    // If IPv4, modify to IPv6
    var remoteIP = event.remoteIP;
    var address = new ip.v6.Address(remoteIP);
    if (!(address.isValid())) {
        // Fallback to ipv4
        address = new ip.v4.Address(remoteIP);
        if (!(address.isValid())) {
            context.fail("Bad Request: Uh oh! [" + remoteIP + "] doesn't look like a valid IP address");
            return;
        }
        address = ip.v6.Address.fromAddress4(remoteIP);
    }
    console.log("Identified address " + address.correctForm() + " (" + address.getBits() + ")");
    // TODO: Weed out private address spaces

    // TODO: Weed out well-known NAT endpoints
    var key = {
        IP: {N: address.getBits().toString()}
    }
    ddb.getItemAsync({TableName: config.aws.ddbtable, Key: key}).then(function(data) {
        if (!(data && data.Item)) {
            context.fail("Not Found: Sorry, we can't seem to find any record for " + remoteIP);
            return;
        }
        var item = {
            IP: remoteIP,
            Lat: data.Item.Lat.S,
            Lon: data.Item.Lon.S,
            LastUpdated: data.Item.Updated.N,
        };
        context.succeed(item);
    }).catch(function(e) {
        context.fail("Server Error: " + e);
    });
}

function noop(events, context) {
    context.succeed();
}

module.exports.set = set;
module.exports.get = get;
module.exports.noop = noop;