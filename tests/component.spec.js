const assert = require("assert");
const path = require("path");
const { exec } = require("child_process");

const bin = path.resolve(__dirname, "../dist/cli.js");
const fixtureDir = path.resolve(__dirname, "./fixture");

const spec = (err, stdout) => {
  assert.equal(Boolean(err), true);
  assert.ok(
    stdout.includes(`/ComponentOne.vue
2:40 Property 'property' does not exist on type '{ value: number; }'.
  0 | <template>
  1 |   <div id="app">
> 2 |     <p v-for="item in items" :key="item.property">{{ item.value }}</p>
    |                                         ^^^^^^^^
  3 |   </div>
  4 | </template>
`)
  );

  assert.ok(
    stdout.includes(`ComponentOne.vue
22:26 Property 'what' does not exist on type '{ error: string; success: string; }'.
  20 |         success: 'success message'
  21 |       }
> 22 |       console.log(message.what);
     |                           ^^^^
  23 |     }
  24 |   }`)
  );
}

exec(`node ${bin} --rootDir ${fixtureDir}`, spec);
exec(`node ${bin} --rootDir ${fixtureDir} --onlyTypeScript`, spec);
exec(`node ${bin} --rootDir ${fixtureDir} --excludeDir ./`, (err, stdout) => {
  assert.equal(Boolean(err), false);
});
exec(`node ${bin} --rootDir ${fixtureDir} --excludeDir ./ --excludeDir ./tests`, (err, stdout) => {
  assert.equal(Boolean(err), false);
});
