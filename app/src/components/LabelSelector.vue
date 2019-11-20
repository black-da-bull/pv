<template>
  <div>
    <v-list-item-group v-model="innerValue" multiple>
      <v-list>
        <v-list-item v-for="label in items" :key="label.id">
          <template v-slot:default="{ active, toggle }">
            <v-list-item-action>
              <v-checkbox color="accent" v-model="active" @click="toggle"></v-checkbox>
            </v-list-item-action>

            <v-list-item-content>
              <v-list-item-title>{{ label.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ labelAliases(label) }}</v-list-item-subtitle>
            </v-list-item-content>

            <slot :label="label" name="action"></slot>
          </template>
        </v-list-item>
      </v-list>
    </v-list-item-group>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from "vue-property-decorator";
import ApolloClient, { serverBase } from "../apollo";
import gql from "graphql-tag";

@Component
export default class LabelSelector extends Vue {
  @Prop() value!: any[];
  @Prop() items!: any[];

  @Watch("value", { deep: true })
  onValueChange(newVal: any[]) {
    this.innerValue = newVal;
  }

  innerValue = (this.value.length ? this.value : []) as any[];

  labelAliases(label: any) {
    return label.aliases
      .slice()
      .sort()
      .join(", ");
  }

  @Watch("innerValue", { deep: true })
  onInnerValueChange() {
    this.$emit("input", this.innerValue);
  }
}
</script>

<style lang="scss" scoped>
</style>