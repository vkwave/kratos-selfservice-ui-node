// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0
import { Session } from "@ory/client"
import { Nav } from "@ory/elements-markup"
import { BrandCopy } from "../brand/copy"

type NavigationMenuProps = {
  navTitle: string
  session?: Session
  logoutUrl?: string
  selectedLink?: "welcome" | "sessions"
  copy: BrandCopy
}
/**
 * Renders the navigation bar with state
 * @param session
 * @param logoutUrl
 * @returns
 */
export const navigationMenu = ({
  navTitle,
  session,
  logoutUrl,
  selectedLink,
  copy,
}: NavigationMenuProps) => {
  const links = [
    {
      name: copy.overviewLabel,
      href: "welcome",
      iconLeft: "house",
      selected: false,
    },
    {
      name: copy.sessionTitle,
      href: "sessions",
      iconLeft: "users-viewfinder",
      selected: false,
    },
  ].map((link) => {
    if (selectedLink && link.href.includes(selectedLink)) {
      link.selected = true
    }
    return link
  })

  return Nav({
    className: "main-nav",
    navTitle: navTitle,
    navSections: [
      {
        links: links,
      },
      {
        title: copy.accountNavigationLabel,
        titleIcon: "circle-question",
        links: [
          {
            name: copy.signInTitle,
            href: "login",
            iconLeft: "arrow-right-to-bracket",
            iconRight: "up-right-from-square",
            disabled: Boolean(session),
            testId: "login",
            target: "_blank",
          },
          {
            name: copy.signUpLabel,
            href: "registration",
            iconLeft: "arrow-right-to-bracket",
            iconRight: "up-right-from-square",
            disabled: Boolean(session),
            testId: "registration",
            target: "_blank",
          },
          {
            name: copy.recoveryLabel,
            href: "recovery",
            iconLeft: "user-xmark",
            iconRight: "up-right-from-square",
            disabled: Boolean(session),
            testId: "recovery",
            target: "_blank",
          },
          {
            name: copy.verificationLabel,
            href: "verification",
            iconLeft: "user-check",
            iconRight: "up-right-from-square",
            disabled: false,
            testId: "verification",
            target: "_blank",
          },
          {
            name: copy.settingsLabel,
            href: "settings",
            iconLeft: "gear",
            iconRight: "up-right-from-square",
            disabled: !Boolean(session),
            testId: "settings",
            target: "_blank",
          },
          {
            name: copy.logoutLabel,
            href: logoutUrl || "",
            iconLeft: "arrow-right-to-bracket",
            iconRight: "up-right-from-square",
            disabled: !Boolean(session),
            testId: "logout",
          },
        ],
      },
    ],
  })
}
