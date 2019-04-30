import cookie from "cookies-js"
import React from "react"
import { ReadyState } from "react-relay"
import { data as sd } from "sharify"
import styled from "styled-components"

import { color, Flex, Sans } from "@artsy/palette"

import { get } from "Utils/get"
import createLogger from "Utils/logger"
import { NotificationsQueryRenderer } from "./Menus"

const logger = createLogger("Components/NavBar")

export const NotificationsBadge = () => {
  return (
    <NotificationsQueryRenderer
      render={({ error, props }: ReadyState) => {
        // If there's an error hide the badge
        if (error) {
          logger.error(error)
          return null
        }

        // Fetching. If there's a notification count stored in a cookie, display it
        if (!props) {
          return <CircularCount />
        }

        // Get the unread notification count from the server
        const totalUnread = get(
          props,
          p => {
            return p.me.followsAndSaves.notifications.edges.length
          },
          0
        )

        let notifications = totalUnread

        // Update the notification bad with the count, and store it in a cookie
        // so that subsequent page views don't need a fetch in order to render
        // the badge.
        if (notifications > 0) {
          const cachedNotificationCount = Number(
            cookie.get("notification-count")
          )
          if (notifications !== cachedNotificationCount) {
            if (notifications >= 100) {
              notifications = "99+"
            }

            // In force, when a request is made to `/notifications` endpoint,
            // sd.NOTIFICATIONS_COUNT is populated by this cookie.
            cookie.set("notification-count", notifications)
          }
        }

        // User has no notifications; clear the cookie
        if (notifications === 0) {
          cookie.expire("notification-count")
          return null
        }

        return <CircularCount notifications={notifications} />
      }}
    />
  )
}

const CircularCount: React.FC<{ notifications?: string }> = ({
  notifications,
}) => {
  // Check to see if we've got a value from sharify, populated by a cookie on
  // the server.
  const notificationsLabel = notifications || sd.NOTIFICATION_COUNT

  if (!notificationsLabel) {
    return null
  }

  return (
    <Container>
      <Sans size="1" weight="medium" color="white100">
        {notificationsLabel}
      </Sans>
    </Container>
  )
}

const Container = styled(Flex)`
  background-color: ${color("purple100")};
  border-radius: 50%;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 3px;
  right: 0;
`