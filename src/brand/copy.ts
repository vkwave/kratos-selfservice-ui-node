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
  legalLabel: string
  productAccountTitle: string
  overviewLabel: string
  sessionTitle: string
  accountNavigationLabel: string
  signUpLabel: string
  recoveryLabel: string
  verificationLabel: string
  settingsLabel: string
  logoutLabel: string
  welcomeTitle: string
  welcomeDescription: string
  accountServicesTitle: string
  accountServicesDescription: string
  accountSettingsCardTitle: string
  accountSettingsCardDescription: string
  activeSessionsCardTitle: string
  activeSessionsCardDescription: string
  accountRecoveryCardTitle: string
  accountRecoveryCardDescription: string
  emailVerificationCardTitle: string
  emailVerificationCardDescription: string
  supportCardTitle: string
  supportCardDescription: string
  signupDateLabel: string
  authenticationLevelLabel: string
  twoFactorLabel: string
  singleFactorLabel: string
  sessionExpiresAtLabel: string
  sessionAuthenticatedAtLabel: string
  authenticationMethodLabel: string
  projectInformation: (host: string) => string
  sessionInformation: (host: string, identity?: string) => string
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
  legalLabel: "Legal information",
  productAccountTitle: "VKWAVE Account",
  overviewLabel: "Overview",
  sessionTitle: "Session information",
  accountNavigationLabel: "VKWAVE Account",
  signUpLabel: "Sign up",
  recoveryLabel: "Account recovery",
  verificationLabel: "Account verification",
  settingsLabel: "Account settings",
  logoutLabel: "Log out",
  welcomeTitle: "Welcome to VKWAVE",
  welcomeDescription:
    "Sign in, verify your email, recover access, and manage your VKWAVE account from one secure place.",
  accountServicesTitle: "Account services",
  accountServicesDescription:
    "Use these shortcuts to review your account and security settings.",
  accountSettingsCardTitle: "Account settings",
  accountSettingsCardDescription:
    "Update your profile, credentials, and verification methods.",
  activeSessionsCardTitle: "Active sessions",
  activeSessionsCardDescription:
    "Review the identity and authentication level for this session.",
  accountRecoveryCardTitle: "Account recovery",
  accountRecoveryCardDescription:
    "Recover access using your configured recovery address.",
  emailVerificationCardTitle: "Email verification",
  emailVerificationCardDescription:
    "Verify the email address associated with your identity.",
  supportCardTitle: "Support",
  supportCardDescription:
    "Get help with account access and security questions.",
  signupDateLabel: "signup date",
  authenticationLevelLabel: "authentication level",
  twoFactorLabel: "two-factor used (aal2)",
  singleFactorLabel: "single-factor used (aal1)",
  sessionExpiresAtLabel: "session expires at",
  sessionAuthenticatedAtLabel: "session authenticated at",
  authenticationMethodLabel: "authentication method used",
  projectInformation: (host) =>
    `Your VKWAVE account center is running at ${host}.`,
  sessionInformation: (host, identity) =>
    identity
      ? `Your browser holds an active VKWAVE session for ${host}. You are signed in as ${identity}. Changes made in Account Settings are reflected in the decoded session below.`
      : `Your browser holds an active VKWAVE session for ${host}. Changes made in Account Settings are reflected in the decoded session below.`,
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
  legalLabel: "法律信息",
  productAccountTitle: "VKWAVE 账户",
  overviewLabel: "概览",
  sessionTitle: "会话信息",
  accountNavigationLabel: "VKWAVE 账户",
  signUpLabel: "注册",
  recoveryLabel: "账户恢复",
  verificationLabel: "账户验证",
  settingsLabel: "账户设置",
  logoutLabel: "退出登录",
  welcomeTitle: "欢迎使用 VKWAVE",
  welcomeDescription:
    "在一个安全入口中登录、验证邮箱、恢复访问并管理你的 VKWAVE 账户。",
  accountServicesTitle: "账户服务",
  accountServicesDescription: "使用以下入口查看和管理账户及安全设置。",
  accountSettingsCardTitle: "账户设置",
  accountSettingsCardDescription: "更新个人资料、登录凭据和验证方式。",
  activeSessionsCardTitle: "当前会话",
  activeSessionsCardDescription: "查看当前会话的身份和认证等级。",
  accountRecoveryCardTitle: "账户恢复",
  accountRecoveryCardDescription: "使用已配置的恢复地址重新获得访问权限。",
  emailVerificationCardTitle: "邮箱验证",
  emailVerificationCardDescription: "验证与你的身份关联的邮箱地址。",
  supportCardTitle: "帮助与支持",
  supportCardDescription: "获取账户访问和安全问题的帮助。",
  signupDateLabel: "注册时间",
  authenticationLevelLabel: "认证等级",
  twoFactorLabel: "已使用双因素认证（aal2）",
  singleFactorLabel: "已使用单因素认证（aal1）",
  sessionExpiresAtLabel: "会话过期时间",
  sessionAuthenticatedAtLabel: "会话认证时间",
  authenticationMethodLabel: "使用的认证方式",
  projectInformation: (host) => `VKWAVE 账户中心当前运行于 ${host}。`,
  sessionInformation: (host, identity) =>
    identity
      ? `你的浏览器在 ${host} 上持有有效的 VKWAVE 会话，当前登录身份为 ${identity}。账户设置中的变更会反映在下方解码后的会话中。`
      : `你的浏览器在 ${host} 上持有有效的 VKWAVE 会话。账户设置中的变更会反映在下方解码后的会话中。`,
}

export const copyForLanguage = (language = ""): BrandCopy =>
  language.toLowerCase().startsWith("zh") ? chinese : english
