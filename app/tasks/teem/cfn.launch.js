/**
 * @returns parameters for cloudformation launch
 * 
 */
module.exports=function parameters (data){
    return {
        AMI: data.aimageid,
        InstanceType: data.appInstanceType,
        RootVolumeSize: data.configData.cloud.diskSize,
        AppId: data.appId,
        AppName: data.name,
        KeyPair: data.keyPair,
        Subnet: data.appSubnet,
        SecurityGroup: data.appSecurityGroup
    }
}