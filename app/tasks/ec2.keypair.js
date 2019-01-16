/**
 * @returns formatted specific message for use in any message
 * @params
 * data
 * 
 */

module.exports=function (data, options=[]){
    console.log("DATA In EC2.launch",data.configData);
    var body={
        task: 'createKeyPair',
        params: {
            KeyName: 'teemops-'+data.appId
        },
        region: data.region,
        save: {
            bucket: options['Buckets'].meta,
            path: 'keys/customers/'+data.appId.toString()+'.json'
        }
    };
    return body;
}