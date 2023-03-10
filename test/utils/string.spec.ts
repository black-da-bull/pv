import { expect } from "chai";

import { getExtension, removeExtension } from "../../src/utils/string";
import getExtensionFixtures from "./fixtures/get_extension.fixture";
import removeExtensionFixtures from "./fixtures/remove_extension.fixture";

describe("utils", () => {
  describe("String utils", () => {
    describe("getExtension", () => {
      for (const test of getExtensionFixtures) {
        it(`Should extract "${test[1]}" from "${test[0]}"`, () => {
          expect(getExtension(test[0])).equals(test[1]);
        });
      }
    });

    describe("removeExtension", () => {
      for (const test of removeExtensionFixtures) {
        it("Should work as expected", () => {
          expect(removeExtension(test[0])).equals(test[1]);
        });
      }
    });
  });
});
