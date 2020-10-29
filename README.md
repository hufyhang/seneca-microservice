# Seneca 微服务框架

## 简介

基于NodeJS Seneca和Redis的轻量级微服务框架。服务间使用TCP进行通信。框架继承了Express，方便对RESTful API接口的提供与实现。

## 使用

可以直接通过Clone本仓储，然后 `yarn` 或 `npm install` 下载、安装依赖。

+ 启动微服务注册中心: `node registry.js --redis="redis://localhost:6379/0"`

