/*
Copyright 2019 Google Inc. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import ApiClient from './utils/RestApiClient'
import { createStore } from 'vuex'

const defaultState = (currentUser) => {
  return {
    sketch: {},
    meta: {},
    searchHistory: {},
    scenarios: [],
    hiddenScenarios: [],
    scenarioTemplates: [],
    graphPlugins: [],
    savedGraphs: [],
    tags: [],
    dataTypes: [],
    count: 0,
    currentSearchNode: null,
    currentUser: currentUser,
    activeContext: {
      scenario: {},
      facet: {},
      question: {}
    },
    snackbar: {
      active: false,
      color: "",
      message: "",
      timeout: -1
    },
    contextLinkConf: {},
    sketchAnalyzerList: {},
    activeAnalyses: [],
    analyzerResults: [],
    enabledTimelines: [],
  }
}

// Initial state
const state = defaultState()

export default createStore({
  state,
  mutations: {
    SET_SKETCH(state, payload) {
      state.sketch = payload.objects[0]
      state.meta = payload.meta
    },
    SET_SEARCH_HISTORY(state, payload) {
      state.searchHistory = payload.objects
    },
    SET_SCENARIOS(state, payload) {
      state.scenarios = payload.objects[0]
    },
    SET_SCENARIO_TEMPLATES(state, payload) {
      state.scenarioTemplates = payload.objects
    },
    SET_TIMELINE_TAGS(state, buckets) {
      state.tags = buckets
    },
    SET_DATA_TYPES(state, payload) {
      const buckets = payload.objects[0].field_bucket.buckets
      state.dataTypes = buckets
    },
    SET_COUNT(state, payload) {
      state.count = payload
    },
    SET_SEARCH_NODE(state, payload) {
      state.currentSearchNode = payload
    },
    SET_SIGMA_LIST(state, payload) {
      state.sigmaRuleList = payload.objects
      state.sigmaRuleList_count = payload.meta.rules_count
    },
    SET_ACTIVE_USER(state, payload) {
      ApiClient.getLoggedInUser().then((response) => {
        const currentUser = response.data.objects[0].username
        state.currentUser = currentUser;
      })
    },
    SET_ACTIVE_CONTEXT(state, payload) {
      state.activeContext = payload
    },
    CLEAR_ACTIVE_CONTEXT(state) {
      const payload = {
        scenario: {},
        facet: {},
        question: {}
      }
      state.activeContext = payload
    },
    SET_GRAPH_PLUGINS(state, payload) {
      state.graphPlugins = payload
    },
    SET_SAVED_GRAPHS(state, payload) {
      state.savedGraphs = payload.objects[0] || []
    },
    SET_SNACKBAR(state, snackbar) {
      state.snackbar = snackbar
    },
    RESET_STATE(state, payload) {
      ApiClient.getLoggedInUser().then((response) => {
        const currentUser = response.data.objects[0].username
        Object.assign(state, defaultState(currentUser))
      })
    },
    SET_CONTEXT_LINKS(state, payload) {
      state.contextLinkConf = payload
    },
    SET_ANALYZER_LIST(state, payload) {
      state.sketchAnalyzerList = payload
    },
    SET_ACTIVE_ANALYSES(state, payload) {
      state.activeAnalyses = payload
    },
    ADD_ACTIVE_ANALYSES(state, payload) {
      const freshActiveAnalyses = [
        ...state.activeAnalyses,
        ...payload,
      ]
      state.activeAnalyses = freshActiveAnalyses
    },
    SET_ANALYZER_RESULTS(state, payload) {
      state.analyzerResults = payload
    },
    SET_ENABLED_TIMELINES(state, payload) {
      state.enabledTimelines = payload
    },
    ADD_ENABLED_TIMELINES(state, payload) {
      const freshEnabledTimelines = [
        ...state.enabledTimelines,
        ...payload,
      ]
      state.enabledTimelines = freshEnabledTimelines
    },
    REMOVE_ENABLED_TIMELINES(state, payload) {
      state.enabledTimelines = state.enabledTimelines.filter(tl => !payload.includes(tl))
    },
    TOGGLE_ENABLED_TIMELINE(state, payload) {
      if (state.enabledTimelines.includes(payload)) {
        state.enabledTimelines = state.enabledTimelines.filter(tl => payload !== tl)
      } else {
        const freshEnabledTimelines = [
          ...state.enabledTimelines,
          payload,
        ]
        state.enabledTimelines =  freshEnabledTimelines
      }
    },
  },
  actions: {
    updateSketch(context, sketchId) {
      return ApiClient.getSketch(sketchId)
        .then((response) => {
          context.commit('SET_SKETCH', response.data)
          context.commit('SET_ACTIVE_USER', response.data)
          context.dispatch('updateTimelineTags', { sketchId: sketchId })
          context.dispatch('updateDataTypes', sketchId)
        })
        .catch((e) => { })
    },
    updateCount(context, sketchId) {
      // Count events for all timelines in the sketch
      return ApiClient.countSketchEvents(sketchId)
        .then((response) => {
          context.commit('SET_COUNT', response.data.meta.count)
        })
        .catch((e) => { })
    },
    resetState(context) {
      context.commit('RESET_STATE')
    },
    updateSearchNode(context, nodeId) {
      context.commit('SET_SEARCH_NODE', nodeId)
    },
    updateSearchHistory(context, sketchId) {
      if (!sketchId) {
        sketchId = context.state.sketch.id
      }
      return ApiClient.getSearchHistory(sketchId)
        .then((response) => {
          context.commit('SET_SEARCH_HISTORY', response.data)
        })
        .catch((e) => { })
    },
    updateScenarios(context, sketchId) {
      if (!sketchId) {
        sketchId = context.state.sketch.id
      }
      return ApiClient.getSketchScenarios(sketchId)
        .then((response) => {
          context.commit('SET_SCENARIOS', response.data)
        })
        .catch((e) => { })
    },
    updateScenarioTemplates(context, sketchId) {
      return ApiClient.getScenarioTemplates(sketchId)
        .then((response) => {
          context.commit('SET_SCENARIO_TEMPLATES', response.data)
        })
        .catch((e) => { })
    },
    updateTimelineTags(context, payload) {
      if (!context.state.sketch.active_timelines.length) {
        return
      }
      const formData = {
        aggregator_name: 'field_bucket',
        aggregator_parameters: {
          field: 'tag',
          limit: '1000',
        },
      }
      return ApiClient.runAggregator(payload.sketchId, formData)
        .then((response) => {
          const buckets = response.data.objects[0].field_bucket.buckets
          if (payload.tag && payload.num) {
            const missing = buckets.find(tag => tag.tag === payload.tag) === undefined
            if (missing) {
              buckets.push({ tag: payload.tag, count: payload.num })
            } else {
              const tagIndex = buckets.findIndex(tag => tag.tag === payload.tag)
              buckets[tagIndex].count += payload.num
            }
          }
          context.commit('SET_TIMELINE_TAGS', buckets)
        })
        .catch((e) => { })
    },
    updateDataTypes(context, sketchId) {
      if (!context.state.sketch.active_timelines.length) {
        return
      }
      const formData = {
        aggregator_name: 'field_bucket',
        aggregator_parameters: {
          field: 'data_type',
          limit: '1000',
        },
      }
      return ApiClient.runAggregator(sketchId, formData)
        .then((response) => {
          context.commit('SET_DATA_TYPES', response.data)
        })
        .catch((e) => { })
    },
    updateSigmaList(context) {
      ApiClient.getSigmaRuleList()
        .then((response) => {
          context.commit('SET_SIGMA_LIST', response.data)
        })
        .catch((e) => { })
    },
    setActiveContext(context, activeScenarioContext) {
      context.commit('SET_ACTIVE_CONTEXT', activeScenarioContext)
    },
    clearActiveContext(context) {
      context.commit('CLEAR_ACTIVE_CONTEXT')
    },
    setSnackBar(context, snackbar) {
      context.commit("SET_SNACKBAR", {
        active: true,
        color: snackbar.color,
        message: snackbar.message,
        timeout: snackbar.timeout
      });
    },
    updateContextLinks(context) {
      ApiClient.getContextLinkConfig()
        .then((response) => {
          context.commit('SET_CONTEXT_LINKS', response.data)
      })
      .catch((e) => { })
    },
    updateGraphPlugins(context) {
      ApiClient.getGraphPluginList()
        .then((response) => {
          context.commit('SET_GRAPH_PLUGINS', response.data)
        })
        .catch((e) => { })
    },
    updateSavedGraphs(context, sketchId) {
      if (!sketchId) {
        sketchId = context.state.sketch.id
      }
      ApiClient.getSavedGraphList(sketchId)
        .then((response) => {
        context.commit('SET_SAVED_GRAPHS', response.data)
      })
      .catch((e) => {
        console.error(e)
      })
    },
    updateAnalyzerList(context, sketchId) {
      if (!sketchId) {
        sketchId = context.state.sketch.id
      }
      ApiClient.getAnalyzers(sketchId).then((response) => {
        const analyzerList = {}
        if (response.data !== undefined) {
          response.data.forEach((analyzer) => {
            analyzerList[analyzer.name] = analyzer
          })
        }
        context.commit('SET_ANALYZER_LIST', analyzerList)
      }).catch((e) => {
        console.log(e)
      })
    },
    updateActiveAnalyses(context, activeAnalyses) {
      context.commit('SET_ACTIVE_ANALYSES', activeAnalyses);
    },
    addActiveAnalyses(context, activeAnalyses) {
      context.commit('ADD_ACTIVE_ANALYSES', activeAnalyses);
    },
    updateAnalyzerResults(context, analyzerResults) {
      context.commit('SET_ANALYZER_RESULTS', analyzerResults);
    },
    enableTimeline(context, timeline) {
        context.commit('ADD_ENABLED_TIMELINES', [timeline])
    },
    disableTimeline(context, timeline) {
        context.commit('REMOVE_ENABLED_TIMELINES', [timeline])
    },
    updateEnabledTimelines(context, enabledTimelines) {
        context.commit('SET_ENABLED_TIMELINES', enabledTimelines)
    },
    toggleEnabledTimeline(context, timelineId) {
        context.commit('TOGGLE_ENABLED_TIMELINE', timelineId)
    },
  }
})
