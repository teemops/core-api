/**
 * @returns Stops existing app
 * @params
 * data
 * 
 */
module.exports=function (data, options=[]){
    /*
    Sends to SQS Queue for pick up from Lambda
     */
    var body={
        task: 'app.stop',
        params: {
            appId: data.appId,
            region: data.region,    //region to clone to
            accountId: data.accountId   //which AWS account to clone to
        }
    };
    return body;
}