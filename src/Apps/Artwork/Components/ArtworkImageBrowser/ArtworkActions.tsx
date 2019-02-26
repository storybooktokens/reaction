import { ArtworkActions_artwork } from "__generated__/ArtworkActions_artwork.graphql"
import { track } from "Artsy/Analytics"
import * as Schema from "Artsy/Analytics/Schema"
import { ContextConsumer } from "Artsy/SystemContext"
import SaveButton, { SaveProps, SaveState } from "Components/Artwork/Save"
import { compact } from "lodash"
import { isNull } from "lodash"
import React from "react"
import { createFragmentContainer, graphql } from "react-relay"
import { data as sd } from "sharify"
import styled from "styled-components"
import { slugify } from "underscore.string"
import { Media } from "Utils/Responsive"
import { ArtworkSharePanelFragmentContainer as ArtworkSharePanel } from "./ArtworkSharePanel"

import {
  BellIcon,
  color,
  DownloadIcon,
  EditIcon,
  Flex,
  GenomeIcon,
  HeartIcon,
  Join,
  Link,
  MoreIcon,
  OpenEyeIcon,
  Sans,
  ShareIcon,
  Spacer,
} from "@artsy/palette"
import { ArtworkPopoutPanel } from "./ArtworkPopoutPanel"

interface ArtworkActionsProps {
  artwork: ArtworkActions_artwork
  user?: User
  selectDefaultSlide(): void
}

interface ArtworkActionsState {
  showSharePanel: boolean
  showMorePanel: boolean
}

@track()
export class ArtworkActions extends React.Component<
  ArtworkActionsProps,
  ArtworkActionsState
> {
  state = {
    showSharePanel: false,
    showMorePanel: false,
  }

  @track({
    flow: Schema.Flow.ArtworkShare,
    action_type: Schema.ActionType.Click,
    context_module: Schema.ContextModule.ShareButton,
    type: Schema.Type.Button,
  })
  toggleSharePanel() {
    const showSharePanel = !this.state.showSharePanel
    this.setState({
      showSharePanel,
      showMorePanel: false,
    })
  }

  toggleMorePanel() {
    const showMorePanel = !this.state.showMorePanel
    this.setState({ showMorePanel, showSharePanel: false })
  }

  get isAdmin() {
    const isAdmin = this.props.user && this.props.user.type === "Admin"
    return isAdmin
  }

  getDownloadableImageUrl() {
    const {
      artwork: { is_downloadable, href, artists, title, date },
    } = this.props

    if (is_downloadable || this.isAdmin) {
      const artistNames = artists.map(({ name }) => name).join(", ")
      const filename = slugify(compact([artistNames, title, date]).join(" "))
      const downloadableImageUrl = `${sd.APP_URL}${href}/download/${filename}.jpg` // prettier-ignore
      return downloadableImageUrl
    }
  }

  @track({
    flow: Schema.Flow.ArtworkViewInRoom,
    action_type: Schema.ActionType.Click,
    context_module: Schema.ContextModule.ViewInRoom,
    type: Schema.Type.Button,
  })
  openViewInRoom(mediator) {
    const primaryImageIndex = this.props.selectDefaultSlide()

    setTimeout(() => {
      const {
        artwork: { dimensions, image },
      } = this.props

      mediator &&
        mediator.trigger &&
        mediator.trigger("openViewInRoom", {
          dimensions,
          image,
          primaryImageIndex,
        })
    }, 300)
  }

  renderSaveButton() {
    return <SaveButton artwork={this.props.artwork} render={Save(this.props)} />
  }

  renderViewInRoomButton() {
    return (
      <ContextConsumer>
        {({ mediator }) => (
          <UtilButton
            name="viewInRoom"
            onClick={() => this.openViewInRoom(mediator)}
            label="View in room"
          />
        )}
      </ContextConsumer>
    )
  }

  renderShareButton() {
    return (
      <UtilButton
        name="share"
        onClick={this.toggleSharePanel.bind(this)}
        label="Share"
      />
    )
  }

  renderDownloadButton() {
    return (
      <UtilButton
        name="download"
        href={this.getDownloadableImageUrl()}
        label="Download"
      />
    )
  }

  renderEditButton() {
    const { artwork } = this.props
    const editUrl = `${sd.CMS_URL}/artworks/${artwork.id}/edit?current_partner_id=${artwork.partner.id}` // prettier-ignore

    return <UtilButton name="edit" href={editUrl} label="Edit" />
  }

  renderGenomeButton() {
    const { artwork } = this.props
    const genomeUrl = `${sd.GENOME_URL}/genome/artworks?artwork_ids=${artwork.id}` // prettier-ignore

    return <UtilButton name="genome" href={genomeUrl} label="Genome" />
  }

  render() {
    const { artwork } = this.props
    const downloadableImageUrl = this.getDownloadableImageUrl()

    const actionsToShow = [
      { name: "save", condition: true, renderer: this.renderSaveButton },
      {
        name: "viewInRoom",
        condition: artwork.is_hangable && this.isAdmin,
        renderer: this.renderViewInRoomButton,
      },
      { name: "share", condition: true, renderer: this.renderShareButton },
      {
        name: "download",
        condition: !!downloadableImageUrl,
        renderer: this.renderDownloadButton,
      },
      {
        name: "edit",
        condition: this.isAdmin,
        renderer: this.renderEditButton,
      },
      {
        name: "genome",
        condition: this.isAdmin,
        renderer: this.renderGenomeButton,
      },
    ]

    const showableActions = actionsToShow.filter(action => {
      return action.condition
    })

    const initialActions = showableActions.slice(0, 3)
    const moreActions = showableActions.slice(3)

    return (
      <>
        <Container>
          <Join separator={<Spacer mx={0} />}>
            <Media greaterThan="xs">
              <Flex>
                {showableActions.map(action => {
                  return (
                    <div key={action.name}>{action.renderer.bind(this)()}</div>
                  )
                })}
              </Flex>
            </Media>

            <Media at="xs">
              <Flex>
                {initialActions.map(action => {
                  return (
                    <div key={action.name}>{action.renderer.bind(this)()}</div>
                  )
                })}

                {moreActions &&
                  moreActions.length > 0 && (
                    <UtilButton
                      name="more"
                      onClick={this.toggleMorePanel.bind(this)}
                    />
                  )}
              </Flex>
            </Media>
          </Join>

          {this.state.showSharePanel && (
            <ArtworkSharePanel
              artwork={this.props.artwork}
              onClose={this.toggleSharePanel.bind(this)}
            />
          )}

          {this.state.showMorePanel && (
            <ArtworkPopoutPanel
              title="More actions"
              onClose={this.toggleMorePanel.bind(this)}
            >
              <Flex flexDirection="row" flexWrap="wrap">
                {moreActions.map(action => {
                  return (
                    <Flex flexDirection="row" flexBasis="50%" key={action.name}>
                      {action.renderer.bind(this)()}
                    </Flex>
                  )
                })}
              </Flex>
            </ArtworkPopoutPanel>
          )}
        </Container>
      </>
    )
  }
}

export const ArtworkActionsFragmentContainer = createFragmentContainer(
  (props: ArtworkActionsProps) => {
    return (
      <ContextConsumer>
        {({ user }) => <ArtworkActions user={user} {...props} />}
      </ContextConsumer>
    )
  },
  graphql`
    fragment ArtworkActions_artwork on Artwork {
      ...Save_artwork
      ...ArtworkSharePanel_artwork

      artists {
        name
      }
      date
      dimensions {
        cm
      }
      href
      id
      image {
        id
        url(version: "larger")
        height
        width
      }
      is_downloadable
      is_hangable
      partner {
        id
      }
      title
      sale {
        is_closed
        is_auction
      }
    }
  `
)

interface UtilButtonProps {
  name:
    | "bell"
    | "edit"
    | "download"
    | "genome"
    | "heart"
    | "more"
    | "share"
    | "viewInRoom"
  href?: string
  onClick?: () => void
  selected?: boolean
  label?: string
}

export class UtilButton extends React.Component<
  UtilButtonProps,
  { hovered: boolean }
> {
  state = {
    hovered: false,
  }

  render() {
    const { href, label, name, onClick, ...props } = this.props

    const getIcon = () => {
      switch (name) {
        case "bell":
          return BellIcon
        case "download":
          return DownloadIcon
        case "edit":
          return EditIcon
        case "genome":
          return GenomeIcon
        case "heart":
          return HeartIcon
        case "more":
          return MoreIcon
        case "share":
          return ShareIcon
        case "viewInRoom":
          return OpenEyeIcon
      }
    }

    const Icon = getIcon()
    const defaultFill = name === "more" ? null : color("black100")
    const fill = this.state.hovered ? color("purple100") : defaultFill

    return (
      <UtilButtonContainer
        p={1}
        pt={0}
        onMouseOver={() => this.setState({ hovered: true })}
        onMouseOut={() =>
          this.setState({
            hovered: false,
          })
        }
        onClick={onClick}
      >
        {href ? (
          <UtilButtonLink className="noUnderline" href={href} target="_blank">
            <Icon {...props} fill={fill} />
            {label && (
              <Sans size="2" pl={0.5} pt="1px">
                {label}
              </Sans>
            )}
          </UtilButtonLink>
        ) : (
          <>
            <Icon {...props} fill={fill} />
            {label && (
              <Sans size="2" pl={0.5} pt="1px">
                {label}
              </Sans>
            )}
          </>
        )}
      </UtilButtonContainer>
    )
  }
}

const UtilButtonLink = styled(Link)`
  display: flex;

  &:hover {
    color: ${color("purple100")} !important;
    text-decoration: none !important;
  }
`

const UtilButtonContainer = styled(Flex)`
  cursor: pointer;
  justify-content: center;

  &:hover {
    color: ${color("purple100")};
  }
`

const Container = styled(Flex).attrs({
  justifyContent: "center",
  mb: 2,
  ml: 0.5,
  pt: 3,
})`
  position: relative;
  user-select: none;
`

/**
 * Custom renderer for SaveButton
 */
const Save = (actionProps: ArtworkActionsProps) => (
  props: SaveProps,
  state: SaveState
) => {
  // Grab props from ArtworkActions to check if sale is open
  const { sale } = actionProps.artwork
  const isOpenSale = sale && sale.is_auction && !sale.is_closed

  // Check if saved by evaluating props from SaveButton
  const isSaved = isNull(state.is_saved)
    ? props.artwork.is_saved
    : state.is_saved

  // If an Auction, use Bell (for notifications); if a standard artwork use Heart
  if (isOpenSale) {
    return <UtilButton name="bell" selected={isSaved} label="Watch lot" />
  } else {
    return <UtilButton name="heart" selected={isSaved} label="Save" />
  }
}

ArtworkActionsFragmentContainer.displayName = "ArtworkActions"
