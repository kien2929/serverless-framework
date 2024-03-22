import AWS from'aws-sdk'

let options = {}

const dynamoDbClient = new AWS.DynamoDB.DocumentClient(options)

export default dynamoDbClient
