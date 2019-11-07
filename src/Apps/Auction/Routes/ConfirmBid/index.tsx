import { Box, Separator, Serif } from "@artsy/palette"
import { BidderPositionQueryResponse } from "__generated__/BidderPositionQuery.graphql"
import {
  ConfirmBidCreateBidderPositionMutation,
  ConfirmBidCreateBidderPositionMutationResponse,
} from "__generated__/ConfirmBidCreateBidderPositionMutation.graphql"
import { routes_ConfirmBidQueryResponse } from "__generated__/routes_ConfirmBidQuery.graphql"
import { BidFormFragmentContainer as BidForm } from "Apps/Auction/Components/BidForm"
import { LotInfoFragmentContainer as LotInfo } from "Apps/Auction/Components/LotInfo"
import { AppContainer } from "Apps/Components/AppContainer"
import { trackPageViewWrapper } from "Apps/Order/Utils/trackPageViewWrapper"
import { track } from "Artsy"
import * as Schema from "Artsy/Analytics/Schema"
import { useTracking } from "Artsy/Analytics/useTracking"
import { FormikActions } from "formik"
import qs from "qs"
import React from "react"
import { Title } from "react-head"
import {
  commitMutation,
  createFragmentContainer,
  graphql,
  RelayProp,
} from "react-relay"
import { data as sd } from "sharify"
import { get } from "Utils/get"
import createLogger from "Utils/logger"

import { bidderPositionQuery } from "Apps/Auction/Routes/ConfirmBid/BidderPositionQuery"

const logger = createLogger("Apps/Auction/Routes/ConfirmBid")

interface ConfirmBidProps {
  artwork: routes_ConfirmBidQueryResponse["artwork"]
  me: routes_ConfirmBidQueryResponse["me"]
  relay: RelayProp
  location: Location
}

const MAX_POLL_ATTEMPTS = 20

export const ConfirmBidRoute: React.FC<ConfirmBidProps> = props => {
  let pollCount = 0

  const { artwork, me, relay } = props
  const { saleArtwork } = artwork
  const { sale } = saleArtwork

  const { trackEvent } = useTracking()

  function createBidderPosition(maxBidAmountCents: number) {
    return new Promise(async (resolve, reject) => {
      commitMutation<ConfirmBidCreateBidderPositionMutation>(
        relay.environment,
        {
          onCompleted: data => {
            resolve(data)
          },
          onError: error => {
            reject(error)
          },
          // TODO: Inputs to the mutation might have changed case of the keys!
          mutation: graphql`
            mutation ConfirmBidCreateBidderPositionMutation(
              $input: BidderPositionInput!
            ) {
              createBidderPosition(input: $input) {
                result {
                  position {
                    internalID
                    saleArtwork {
                      sale {
                        registrationStatus {
                          internalID
                        }
                      }
                    }
                  }
                  status
                  messageHeader
                  messageDescriptionMD
                }
              }
            }
          `,
          variables: {
            input: {
              saleID: sale.internalID,
              artworkID: artwork.internalID,
              maxBidAmountCents,
            },
          },
        }
      )
    })
  }

  function handleMutationError(
    actions: FormikActions<object>,
    error: Error,
    bidderId: string
  ) {
    logger.error(error)

    let errorMessages: string[]
    if (Array.isArray(error)) {
      errorMessages = error.map(e => e.message)
    } else if (typeof error === "string") {
      errorMessages = [error]
    } else if (error.message) {
      errorMessages = [error.message]
    }

    trackConfirmBidFailed(bidderId, errorMessages)

    actions.setSubmitting(false)
    actions.setStatus("submissionFailed")
  }

  function trackConfirmBidFailed(bidderId: string, errors: string[]) {
    trackEvent({
      action_type: Schema.ActionType.ConfirmBidFailed,
      bidder_id: bidderId,
      error_messages: errors,
    })
  }

  function trackConfirmBidSuccess(
    positionId: string,
    bidderId: string,
    selectedBidAmountCents: number
  ) {
    trackEvent({
      action_type: Schema.ActionType.ConfirmBidSubmitted,
      bidder_position_id: positionId,
      bidder_id: bidderId,
      order_id: bidderId,
      products: [
        {
          product_id: artwork.internalID,
          quantity: 1,
          price: selectedBidAmountCents / 100,
        },
      ],
    })
  }

  function handleSubmit(
    values: { selectedBid: number },
    actions: FormikActions<object>
  ) {
    const selectedBid = Number(values.selectedBid)
    const possibleExistingBidderId: string | null = sale.registrationStatus
      ? sale.registrationStatus.internalID
      : null

    createBidderPosition(selectedBid)
      .then((data: ConfirmBidCreateBidderPositionMutationResponse) => {
        if (data.createBidderPosition.result.status !== "SUCCESS") {
          trackConfirmBidFailed(possibleExistingBidderId, [
            "ConfirmBidCreateBidderPositionMutation failed",
          ])
        } else {
          const bidderIdFromMutation =
            data.createBidderPosition.result.position.saleArtwork.sale
              .registrationStatus.internalID
          verifyBidderPosition({
            data,
            bidderId: bidderIdFromMutation,
            selectedBid,
          })
        }
      })
      .catch(error => {
        handleMutationError(actions, error, possibleExistingBidderId)
        actions.setSubmitting(false)
      })
  }

  function verifyBidderPosition({
    data,
    bidderId,
    selectedBid,
  }: {
    data: ConfirmBidCreateBidderPositionMutationResponse
    bidderId: string
    selectedBid: number
  }) {
    const { result } = data.createBidderPosition
    const { position } = result

    if (result.status === "SUCCESS") {
      bidderPositionQuery(relay.environment, {
        bidderPositionID: position.internalID,
      })
        .then(response =>
          checkBidderPosition({ data: response, bidderId, selectedBid })
        )
        .catch(error => console.error(error)) // TODO: Implement error handling. story: AUCT-713
    } else {
      // TODO: Implement error handling. story: AUCT-713
      console.error("Bid result was not SUCCESS:", data)
    }
  }

  function checkBidderPosition({
    data,
    bidderId,
    selectedBid,
  }: {
    data: BidderPositionQueryResponse
    bidderId: string
    selectedBid: number
  }) {
    const { bidderPosition } = data.me

    if (bidderPosition.status === "PENDING" && pollCount < MAX_POLL_ATTEMPTS) {
      // initiating new request here (vs setInterval) to make sure we wait for
      // the previous call to return before making a new one
      setTimeout(
        () =>
          bidderPositionQuery(relay.environment, {
            bidderPositionID: bidderPosition.position.internalID,
          })
            .then(response =>
              checkBidderPosition({ data: response, bidderId, selectedBid })
            )
            .catch(error => console.error(error)), // TODO: Implement error handling. story: AUCT-713
        1000
      )

      pollCount += 1
    } else if (bidderPosition.status === "WINNING") {
      const positionId = data.me.bidderPosition.position.internalID
      trackConfirmBidSuccess(positionId, bidderId, selectedBid)

      window.location.assign(`${sd.APP_URL}/artwork/${artwork.slug}`)
    } else {
      // TODO: Implement error handling. story: AUCT-713
    }
  }

  return (
    <AppContainer>
      <Title>Confirm Bid | Artsy</Title>

      <Box maxWidth={550} px={[2, 0]} mx="auto" mt={[1, 0]} mb={[1, 100]}>
        <Serif size="8">Confirm your bid</Serif>

        <Separator />

        <LotInfo artwork={artwork} saleArtwork={artwork.saleArtwork} />

        <Separator />

        <BidForm
          initialSelectedBid={getInitialSelectedBid(props.location)}
          showPricingTransparency={false}
          saleArtwork={saleArtwork}
          onSubmit={handleSubmit}
          me={me}
        />
      </Box>
    </AppContainer>
  )
}

const getInitialSelectedBid = (location: Location): string | undefined => {
  return get(
    qs,
    querystring => querystring.parse(location.search.slice(1)).bid,
    undefined
  )
}

const TrackingWrappedConfirmBidRoute: React.FC<ConfirmBidProps> = props => {
  const Component = track<ConfirmBidProps>(p => ({
    context_page: Schema.PageName.AuctionConfirmBidPage,
    auction_slug: p.artwork.saleArtwork.sale.slug,
    artwork_slug: p.artwork.slug,
    sale_id: p.artwork.saleArtwork.sale.internalID,
    user_id: p.me.internalID,
  }))(ConfirmBidRoute)

  return <Component {...props} />
}

export const ConfirmBidRouteFragmentContainer = createFragmentContainer(
  trackPageViewWrapper(TrackingWrappedConfirmBidRoute),
  {}
)
