// Copyright © 2026 VKWAVE
// SPDX-License-Identifier: Apache-2.0
export interface BrandCopy {
  signInTitle: string
  accountSecurity: string
  consentTitle: string
  consentDescription: string
  requestedScopes: string
  requestedResource: string
  redirectDestination: string
  localhostWarning: string
  clientLabel: string
  clientIDLabel: string
  errorTitle: string
  errorDescription: string
  privacyLabel: string
  termsLabel: string
  supportLabel: string
}

const english: BrandCopy = {
  signInTitle: "Sign in to VKWAVE",
  accountSecurity: "Secure account access",
  consentTitle: "Authorize access",
  consentDescription:
    "Review the client, destination, scopes, and resource before continuing.",
  requestedScopes: "Requested permissions",
  requestedResource: "Target resource",
  redirectDestination: "Redirect destination",
  localhostWarning:
    "This client redirects to your local computer. Continue only if you started the connection.",
  clientLabel: "Client",
  clientIDLabel: "Client ID",
  errorTitle: "We could not complete this request",
  errorDescription:
    "Try the flow again. If the problem continues, contact support with the request ID below.",
  privacyLabel: "Privacy",
  termsLabel: "Terms",
  supportLabel: "Support",
}

const chinese: BrandCopy = {
  signInTitle: "登录 VKWAVE",
  accountSecurity: "安全账户访问",
  consentTitle: "授权访问",
  consentDescription: "继续前请核对客户端、回调地址、权限和目标资源。",
  requestedScopes: "请求的权限",
  requestedResource: "目标资源",
  redirectDestination: "回调地址",
  localhostWarning: "该客户端将回调到你的本机。仅在你主动发起连接时继续。",
  clientLabel: "客户端",
  clientIDLabel: "客户端 ID",
  errorTitle: "无法完成此请求",
  errorDescription:
    "请重试此流程。如果问题持续存在，请携带下方请求 ID 联系支持。",
  privacyLabel: "隐私政策",
  termsLabel: "服务条款",
  supportLabel: "帮助与支持",
}

export const copyForLanguage = (language = ""): BrandCopy =>
  language.toLowerCase().startsWith("zh") ? chinese : english
