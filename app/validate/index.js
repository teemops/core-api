/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Validates input message based on schema
 * Mostly used for HTTP/JSON REST calls
 * @usage: request data needs to match schema
 * validate(someMessageData, "app/add")
 */
function validate(message,schema){
    var schemas = require(schema);
    expectedSchema=JSON.parse(schemas());
    
}

module.exports = validateRequest;
