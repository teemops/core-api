/**
 * @returns Clones an app so it can be launched anywhere (region/account/launch config)
 * @params
 * data
 * 
 */
module.exports=function (data, options=[]){
    /*
    Sends to SQS Queue for pick up from Lambda
     */
    var body={
        task: 'app.clone',
        params: {
            appId: data.appId,
            region: data.region,    //region to clone to
            accountId: data.accountId   //which AWS account to clone to
        }
    };
    return body;
}