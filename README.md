## Serverless-framework
### Install
Install serverless locally
```sh
npm i -g serverless
```
Create ENV file
```sh
npm run create-env
```

Install project
```sh
npm run install-dependency
```


### Deploy
#### Deploy lambda-layer
```sh
npm run deploy-layer
```

#### Specify lambda-layer version in `serverless.yml`
(only need to update when deploy a new version of lambda-layer)
```yml
environment:
  ...
  LAYER_VERSION: ${VERSION}
```

#### Deploy your project
```sh
serverless deploy
```
