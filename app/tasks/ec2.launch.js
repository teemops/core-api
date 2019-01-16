/**
 * @returns formatted specific message for use in any message
 * @params
 * data
 * 
 */

module.exports=function (data, options=[]){
    console.log("DATA In EC2.launch",data.configData);
    //define values
    /*
    notify: used to notify based on a unique identifier e.g userid
    filters can be used with curly brackets inside quotes from output of results from message for testing values or storing values in next message
    e.g. '{output.Instances[0].InstanceId}' can be used to get the instanceid from the output of the message being processed
    e.g. error: '{output.Reservations.count!=0}' - This means an error is generated if the output
    task: Name of task you want to run against EC2 SDK
    params: Parameters to pass to EC2 SDK
    region: Region to run EC2 SDK command in
    
    check: checks a condition, if condition is met then 
  
    save: {
        bucket: '{{Buckets.meta}}',
        path: 'apps/vm/'+data.appId.toString()+'.json',
        body: '{{me.Reservations[0].Instances[0]}}'
    }

    Keywords that can be used in filter contexts:
    -output: gets data from output of message being run: Typically used 
    as a way of getting the output of a variable to be used in a post task parameter.
    -me: gets data from output of a Posttask being run. Used for getting the data from the result of a 
    PostTask that has been run and then passing to a save operation such as an S3 bucket.
     */
    var body={
        task: 'runInstances',
        check: {
            id: data.appId,
            conditions: ['STARTED', 'STOPPED', 'STARTING', 'STOPPING', 'RESTARTING', 'DELETING'],
            msg: "Server " + data.name.toString() + " has already been launched.",
            type: "info"
        },
        notify: {
            id: data.appId,
            msg: "Server " + data.name.toString() + " Launched Succesfully.",
            type: "info",
            status: "STARTED"
        },
        params: {
            MinCount: 1,
            MaxCount: 1,
            ImageId: data.aimageid,
            InstanceType: data.appInstanceType,
            SubnetId: data.appSubnet,
            SecurityGroupIds: [data.appSecurityGroup],
            UserData: (typeof(data.configData.cloud.userData)!=undefined ? data.configData.cloud.userData : ""),
            BlockDeviceMappings: [
                {
                  DeviceName: '/dev/sda1',
                  Ebs: {
                    VolumeSize: data.configData.cloud.diskSize,
                    VolumeType: 'gp2'
                  }
                }
            ]
        },
        region: data.region,
        save: {
            bucket: options['Buckets'].meta,
            path: 'apps/vm/'+data.appId.toString()+'.json'
        }
    };
    return body;
}