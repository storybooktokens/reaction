import { ArtistInfoFixture } from "Apps/__tests__/Fixtures/Artwork/ArtistInfo"
import { ArtistInfoFragmentContainer } from "Apps/Artwork/Components/ArtistInfo"
import { track } from "Artsy/Analytics"
import { MockBoot, renderRelayTree } from "DevTools"
import { cloneDeep } from "lodash"
import React from "react"
import { graphql } from "react-relay"

jest.unmock("react-relay")

describe("ArtistInfo", () => {
  const getWrapper = async (response = ArtistInfoFixture) => {
    return await renderRelayTree({
      Component: ArtistInfoFragmentContainer,
      query: graphql`
        query ArtistInfo_Test_Query {
          artist(id: "pablo-picasso") {
            ...ArtistInfo_artist
          }
        }
      `,
      wrapper: n => <MockBoot breakpoint="xs">{n}</MockBoot>,
      mockResolvers: {
        Artist: () => response,
      },
    })
  }
  let wrapper

  describe("ArtistInfo for artwork with complete artist info", () => {
    beforeAll(async () => {
      wrapper = await getWrapper()
    })

    it("renders a correct component tree", () => {
      expect(wrapper.find("EntityHeader").length).toBe(1)
      expect(wrapper.find("ArtistBio").length).toBe(1)
      expect(wrapper.find("Button").length).toBe(1)
      expect(wrapper.find("Button").text()).toEqual("Show artist insights")
      expect(wrapper.find("MarketInsights").length).toBe(0)
      expect(wrapper.find("SelectedExhibitions").length).toBe(0)
    })

    it("shows artist insights when the 'Show artist insights' button is clicked", () => {
      wrapper.find("Button").simulate("click")
      expect(wrapper.find("MarketInsights").length).toBe(1)
      expect(wrapper.find("SelectedExhibitions").length).toBe(1)
    })
  })

  describe("ArtistInfo for artwork with incomplete artist info", () => {
    it("Hides 'Show artist insights' button if no market insights or selected exhibitions data", async () => {
      const data = cloneDeep(ArtistInfoFixture)
      data.highlights.partners = null
      data.collections = null
      data.auctionResults = null
      data.exhibition_highlights = null
      wrapper = await getWrapper(data)
      expect(wrapper.find("Button").length).toBe(0)
    })

    it("hides ArtistBio if no data", async () => {
      const data = cloneDeep(ArtistInfoFixture)
      data.biography_blurb.text = null
      wrapper = await getWrapper(data)
      expect(wrapper.find("ArtistBio").length).toBe(0)
    })

    it("hides MarketInsights if no data", async () => {
      const data = cloneDeep(ArtistInfoFixture)
      data.highlights.partners = null
      data.collections = null
      data.auctionResults = null
      wrapper = await getWrapper(data)
      wrapper.find("Button").simulate("click")
      expect(wrapper.find("MarketInsights").html()).toBe(null)
    })

    it("hides SelectedExhibitions if no data", async () => {
      const data = cloneDeep(ArtistInfoFixture)
      data.exhibition_highlights = []
      wrapper = await getWrapper(data)
      wrapper.find("Button").simulate("click")
      expect(wrapper.find("SelectedExhibitions").html()).toBe(null)
    })
  })

  describe("Analytics", () => {
    beforeAll(async () => {
      wrapper = await getWrapper()
    })
    it("tracks click on 'Show artist insights' button", () => {
      const button = wrapper.find("Button")
      button.simulate("click")
      expect(track).toBeCalledWith({
        action_type: "Click",
        subject: "Show artist insights",
        flow: "Artwork about the artist",
        type: "Button",
      })
    })
  })
})
