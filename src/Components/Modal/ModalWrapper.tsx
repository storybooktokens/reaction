import { Theme } from "@artsy/palette"
import React from "react"
import styled, { injectGlobal, keyframes } from "styled-components"
import FadeTransition from "../Animation/FadeTransition"
import { media } from "../Helpers"
import { CtaProps } from "./ModalCta"

export interface ModalWrapperProps extends React.HTMLProps<ModalWrapper> {
  blurContainerSelector?: string
  cta?: CtaProps
  onClose?: () => void
  isWide?: boolean
  image?: string
  show?: boolean
}

export interface ModalWrapperState {
  isAnimating: boolean
  isShown: boolean
  blurContainers: Element[]
}

injectGlobal`
  .blurred {
    filter: blur(50px);
  }
`

export class ModalWrapper extends React.Component<
  ModalWrapperProps,
  ModalWrapperState
> {
  static defaultProps = {
    show: false,
    blurContainerSelector: "",
  }

  state = {
    isAnimating: this.props.show || false,
    isShown: this.props.show || false,
    blurContainers: this.props.blurContainerSelector
      ? Array.from(document.querySelectorAll(this.props.blurContainerSelector))
      : [],
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.show !== nextProps.show) {
      this.setState({
        isAnimating: true,
        isShown: nextProps.show,
      })
    }
  }

  componentWillUnmount() {
    this.removeBlurToContainers()
  }

  close = () => {
    this.props.onClose()
    this.removeBlurToContainers()
  }

  addBlurToContainers = () => {
    for (const container of this.state.blurContainers) {
      container.classList.add("blurred")
    }
  }

  removeBlurToContainers = () => {
    for (const container of this.state.blurContainers) {
      container.classList.remove("blurred")
    }
  }

  render(): JSX.Element {
    const { children, isWide, image } = this.props
    const { isShown, isAnimating } = this.state

    if (isShown) {
      this.addBlurToContainers()
    } else {
      this.removeBlurToContainers()
    }

    return (
      <Theme>
        <Wrapper isShown={isShown || isAnimating}>
          {isShown && <ModalOverlay onClick={this.close} />}
          <FadeTransition
            in={isShown}
            mountOnEnter
            onExited={() => {
              this.setState({ isAnimating: false })
            }}
            unmountOnExit
            timeout={{ enter: 10, exit: 200 }}
          >
            <ModalContainer isWide={isWide} image={image}>
              <ModalInner>{children}</ModalInner>
            </ModalContainer>
          </FadeTransition>
        </Wrapper>
      </Theme>
    )
  }
}

const Wrapper = styled.div.attrs<{ isShown?: boolean }>({})`
  ${props =>
    props.isShown &&
    `
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9999
  `};
`

const slideUp = keyframes`
  from {
    transform: translate(-50%,-40%);
    opacity: 0;
  },

  to {
    transform: translate(-50%,-50%);
    opacity: 1;
  }
`

export const ModalOverlay = styled.div`
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: rgba(200, 200, 200, 0.5);
`

export const ModalContainer = styled.div.attrs<{
  isWide?: boolean
  image?: string
}>({})`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  width: ${props => (props.isWide || props.image ? "900px" : "440px")};
  height: min-content;
  border-radius: 5px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  animation: ${slideUp} 250ms linear;

  ${media.sm`
    width: 100%;
    border-radius: 0;
  `};
`

const ModalInner = styled.div`
  /* disabling scrolling until custom scrollbars are implemented */
  /* overflow-y: scroll; */
  max-height: calc(100vh - 80px);
  ${media.sm`
    max-height: 100vh;
    height: 100vh
  `};
`

export default ModalWrapper
