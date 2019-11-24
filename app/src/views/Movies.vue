<template>
  <div>
    <v-navigation-drawer v-model="drawer" :permanent="$vuetify.breakpoint.mdAndUp" clipped app>
      <v-container>
        <v-checkbox v-model="useDVDCoverRatio" label="Use DVD Cover ratio"></v-checkbox>
        <v-text-field clearable color="accent" v-model="query" label="Search query"></v-text-field>

        <v-subheader>Labels</v-subheader>
        <v-chip-group
          active-class="accent--text"
          :items="allLabels"
          column
          v-model="selectedLabels"
          multiple
        >
          <div style="max-height:40vh; overflow-y:scroll">
            <v-chip label small v-for="label in allLabels" :key="label._id">{{ label.name }}</v-chip>
          </div>
        </v-chip-group>
        <v-select
          hide-details
          color="accent"
          item-text="text"
          item-value="value"
          v-model="sortBy"
          placeholder="Sort by..."
          :items="sortByItems"
        ></v-select>
        <v-select
          :disabled="sortBy == 'relevance'"
          hide-details
          color="accent"
          item-text="text"
          item-value="value"
          v-model="sortDir"
          placeholder="Sort direction"
          :items="sortDirItems"
        ></v-select>
        <v-checkbox hide-details v-model="favoritesOnly" label="Show favorites only"></v-checkbox>
        <v-checkbox hide-details v-model="bookmarksOnly" label="Show bookmarks only"></v-checkbox>

        <v-rating
          half-increments
          @input="ratingFilter = $event * 2"
          :value="ratingFilter / 2"
          class="pb-0 pa-2"
          background-color="grey"
          color="amber"
          dense
          hide-details
        ></v-rating>
        <div class="pl-3 mt-1 med--text caption hover" @click="ratingFilter = 0">Reset rating filter</div>
      </v-container>
    </v-navigation-drawer>

    <div v-if="!fetchLoader">
      <div class="d-flex align-center">
        <h1 class="font-weight-light mr-3">Movies</h1>
        <v-btn class="mr-3" @click="openCreateDialog" icon>
          <v-icon>mdi-plus</v-icon>
        </v-btn>
      </div>
      <v-row>
        <v-col class="pa-1" v-for="movie in movies" :key="movie._id" cols="6" sm="6" md="4" lg="3">
          <MovieCard
            :ratio="useDVDCoverRatio ? undefined : 1"
            :movie="movie"
            style="height: 100%"
            @bookmark="bookmark(movie._id, $event)"
            @favorite="favorite(movie._id, $event)"
          />
        </v-col>
      </v-row>
    </div>
    <div v-else class="text-center">
      <p>Loading...</p>
      <v-progress-circular indeterminate></v-progress-circular>
    </div>

    <v-dialog scrollable v-model="createMovieDialog" max-width="400px">
      <v-card :loading="addMovieLoader">
        <v-card-title>Add new movie</v-card-title>
        <v-card-text style="max-height: 90vh">
          <v-form v-model="validCreation">
            <v-text-field
              :rules="movieNameRules"
              color="accent"
              v-model="createMovieName"
              placeholder="Name"
            />
            <SceneSelector :multiple="true" class="mb-2" v-model="createMovieScenes" />
          </v-form>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            text
            class="text-none"
            :disabled="!validCreation"
            color="accent"
            @click="addMovie"
          >Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <infinite-loading :identifier="infiniteId" @infinite="infiniteHandler">
      <div slot="no-results">
        <v-icon large>mdi-close</v-icon>
        <div>Nothing found!</div>
      </div>

      <div slot="spinner">
        <v-progress-circular indeterminate></v-progress-circular>
        <div>Loading...</div>
      </div>

      <div slot="no-more">
        <v-icon large>mdi-emoticon-wink</v-icon>
        <div>That's all!</div>
      </div>
    </infinite-loading>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from "vue-property-decorator";
import ApolloClient, { serverBase } from "../apollo";
import gql from "graphql-tag";
import sceneFragment from "../fragments/scene";
import actorFragment from "../fragments/actor";
import { contextModule } from "../store/context";
import InfiniteLoading from "vue-infinite-loading";
import SceneSelector from "../components/SceneSelector.vue";
import IScene from "../types/scene";
import IActor from "../types/actor";
import ILabel from "../types/label";
import MovieCard from "../components/MovieCard.vue";
import IMovie from "../types/movie";
import movieFragment from "../fragments/movie";

@Component({
  components: {
    InfiniteLoading,
    SceneSelector,
    MovieCard
  }
})
export default class MovieList extends Vue {
  movies = [] as IMovie[];
  fetchLoader = false;

  waiting = false;
  allLabels = [] as ILabel[];
  selectedLabels = [] as number[];

  validCreation = false;
  createMovieDialog = false;
  createMovieName = "";
  createMovieScenes = [] as IScene[];
  addMovieLoader = false;

  movieNameRules = [v => (!!v && !!v.length) || "Invalid scene name"];

  query = "";
  page = 0;

  sortDir = "desc";
  sortDirItems = [
    {
      text: "Ascending",
      value: "asc"
    },
    {
      text: "Descending",
      value: "desc"
    }
  ];

  sortBy = "relevance";
  sortByItems = [
    {
      text: "Relevance",
      value: "relevance"
    },
    {
      text: "Added to collection",
      value: "addedOn"
    },
    {
      text: "Rating",
      value: "rating"
    },
    {
      text: "Views",
      value: "views"
    }
  ];

  favoritesOnly = false;
  bookmarksOnly = false;
  ratingFilter = 0;

  infiniteId = 0;
  resetTimeout = null as NodeJS.Timeout | null;

  useDVDCoverRatio = true;

  get drawer() {
    return contextModule.showFilters;
  }

  set drawer(val: boolean) {
    contextModule.toggleFilters(val);
  }

  openCreateDialog() {
    this.createMovieDialog = true;
  }

  addMovie() {
    this.addMovieLoader = true;
    ApolloClient.mutate({
      mutation: gql`
        mutation($name: String!, $scenes: [String!]) {
          addMovie(name: $name, scenes: $scenes) {
            ...MovieFragment
            actors {
              ...ActorFragment
            }
            scenes {
              ...SceneFragment
              actors {
                ...ActorFragment
              }
            }
          }
        }
        ${movieFragment}
        ${sceneFragment}
        ${actorFragment}
      `,
      variables: {
        name: this.createMovieName,
        scenes: this.createMovieScenes.map(a => a._id)
      }
    })
      .then(res => {
        this.movies.unshift(res.data.addMovie);
        this.createMovieDialog = false;
        this.createMovieName = "";
        this.createMovieScenes = [];
        this.selectedLabels = [];
      })
      .catch(() => {})
      .finally(() => {
        this.addMovieLoader = false;
      });
  }

  favorite(id: any, favorite: boolean) {
    const index = this.movies.findIndex(sc => sc._id == id);

    if (index > -1) {
      const movie = this.movies[index];
      movie.favorite = favorite;
      Vue.set(this.movies, index, movie);
    }
  }

  bookmark(id: any, bookmark: boolean) {
    const index = this.movies.findIndex(sc => sc._id == id);

    if (index > -1) {
      const movie = this.movies[index];
      movie.bookmark = bookmark;
      Vue.set(this.movies, index, movie);
    }
  }

  movieLabels(movie: any) {
    return movie.labels.map(l => l.name).sort();
  }

  movieActorNames(movie: any) {
    return movie.actors.map(a => a.name).join(", ");
  }

  @Watch("ratingFilter", {})
  onRatingChange(newVal: number) {
    this.page = 0;
    this.movies = [];
    this.infiniteId++;
  }

  @Watch("favoritesOnly")
  onFavoriteChange() {
    this.page = 0;
    this.movies = [];
    this.infiniteId++;
  }

  @Watch("bookmarksOnly")
  onBookmarkChange() {
    this.page = 0;
    this.movies = [];
    this.infiniteId++;
  }

  @Watch("sortDir")
  onSortDirChange() {
    this.page = 0;
    this.movies = [];
    this.infiniteId++;
  }

  @Watch("sortBy")
  onSortChange() {
    this.page = 0;
    this.movies = [];
    this.infiniteId++;
  }

  @Watch("selectedLabels")
  onLabelChange() {
    this.page = 0;
    this.movies = [];
    this.infiniteId++;
  }

  @Watch("query")
  onQueryChange() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }

    this.waiting = true;
    this.page = 0;
    this.movies = [];

    this.resetTimeout = setTimeout(() => {
      this.waiting = false;
      this.infiniteId++;
    }, 500);
  }

  infiniteHandler($state) {
    this.fetchPage().then(items => {
      if (items.length) {
        this.page++;
        this.movies.push(...items);
        $state.loaded();
      } else {
        $state.complete();
      }
    });
  }

  async fetchPage() {
    try {
      let include = "";

      if (this.selectedLabels.length)
        include =
          "include:" +
          this.selectedLabels.map(i => this.allLabels[i]._id).join(",");

      const query = `query:'${this.query || ""}' ${include} page:${
        this.page
      } sortDir:${this.sortDir} sortBy:${this.sortBy} favorite:${
        this.favoritesOnly ? "true" : "false"
      } bookmark:${this.bookmarksOnly ? "true" : "false"} rating:${
        this.ratingFilter
      }`;

      const result = await ApolloClient.query({
        query: gql`
          query($query: String) {
            getMovies(query: $query) {
              ...MovieFragment
              actors {
                ...ActorFragment
              }
              scenes {
                ...SceneFragment
                actors {
                  ...ActorFragment
                }
              }
            }
          }
          ${movieFragment}
          ${sceneFragment}
          ${actorFragment}
        `,
        variables: {
          query
        }
      });

      return result.data.getMovies;
    } catch (err) {
      throw err;
    }
  }

  beforeMount() {
    ApolloClient.query({
      query: gql`
        {
          getLabels {
            _id
            name
            aliases
          }
        }
      `
    })
      .then(res => {
        this.allLabels = res.data.getLabels;
      })
      .catch(err => {
        console.error(err);
      });
  }
}
</script>