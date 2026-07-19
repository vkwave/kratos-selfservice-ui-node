// Copyright © 2026 VKWAVE
// SPDX-License-Identifier: Apache-2.0
export const appendIfPresent = (
  query: URLSearchParams,
  name: string,
  value: unknown,
): void => {
  if (typeof value === "string" && value.length > 0) {
    query.set(name, value)
  }
}
