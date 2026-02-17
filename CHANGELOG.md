# Changelog

All notable changes to Chrondle will be documented in this file.

## [1.0.1](https://github.com/misty-step/chrondle/compare/v1.0.0...v1.0.1) (2026-02-17)

### Bug Fixes

- **ci:** use GH_RELEASE_TOKEN for semantic-release ([18e1af8](https://github.com/misty-step/chrondle/commit/18e1af8933c72f7cb23c24cb3f855ddaabf0c4f5))
- unblock type-check for Stripe apiVersion ([#177](https://github.com/misty-step/chrondle/issues/177)) ([a10d5f5](https://github.com/misty-step/chrondle/commit/a10d5f5f4911fb7e89bf7ef78fc1b7e09ead8c18))

# 1.0.0 (2026-01-28)

- feat!: remove notification system core files ([5f80970](https://github.com/misty-step/chrondle/commit/5f809705054ec40a16061365515e7733ba48f50c))

### Bug Fixes

- add comprehensive auth edge case diagnostics and shared submission logic ([0b9adc6](https://github.com/misty-step/chrondle/commit/0b9adc642ddd860ecb376710fb7c68701633ff63))
- add const assertions to vitest config for TypeScript compatibility ([2da5309](https://github.com/misty-step/chrondle/commit/2da530976096bda86017b8bdf4e88a07ab2f70ae))
- add contents read permission to size-limit workflow ([7e73451](https://github.com/misty-step/chrondle/commit/7e73451eb02bade6c39ce348755e12701d57e6ab))
- add Convex generated files back to Git for Vercel builds ([68811be](https://github.com/misty-step/chrondle/commit/68811be676bdb6da54eb04c456e0041f7daca9c8))
- add eslint-disable comments for test mocks ([07a8ec7](https://github.com/misty-step/chrondle/commit/07a8ec775778a12c4d1de6c0559c1270eebcae82))
- add explicit types to withObservability wrapper handler ([0b0feb8](https://github.com/misty-step/chrondle/commit/0b0feb87388d8e38392fbb922cae4c11ab3a1af1))
- add missing environment variables to Lighthouse CI step ([f0b3279](https://github.com/misty-step/chrondle/commit/f0b32790e3031730283947b3236fadea3161142f)), closes [#18](https://github.com/misty-step/chrondle/issues/18)
- add missing validate-puzzles script to fix CI ([e1da8d1](https://github.com/misty-step/chrondle/commit/e1da8d12c91a4b4c6a099c0d034acc06440fc05e))
- add production Clerk domain to CSP headers ([35c7511](https://github.com/misty-step/chrondle/commit/35c7511e12ab38d72cc5d459f0b8a9ce45ec5ace))
- add required environment variables to size-limit workflow ([08dacd0](https://github.com/misty-step/chrondle/commit/08dacd07b1f0f63e233312cb7fd3744bcd4d4897)), closes [#20](https://github.com/misty-step/chrondle/issues/20)
- add type annotations to manage-events script ([53d4b58](https://github.com/misty-step/chrondle/commit/53d4b584638bd8ed1ac742fb3b09268e805b0f2d))
- add useReducedMotion mock to all test files ([95a670c](https://github.com/misty-step/chrondle/commit/95a670c8dea61192627fa8124ed8fffc07566dfe))
- address critical PR [#31](https://github.com/misty-step/chrondle/issues/31) feedback ([70d2e81](https://github.com/misty-step/chrondle/commit/70d2e813839f358cf84cf6ee4d76efad1f87dfc9))
- address order accessibility findings ([2d66621](https://github.com/misty-step/chrondle/commit/2d6662170b25e86013d093d3819a5df0bbd790d0))
- address PR review feedback ([f628242](https://github.com/misty-step/chrondle/commit/f628242a5e4f3aaaeee6385a3c0c4a46b0bd87c2))
- address PR review feedback - DSN, remove Slack, improve error handling ([cfff2a1](https://github.com/misty-step/chrondle/commit/cfff2a169cb92d55db7bd0a7e16a2987e670a949))
- address PR review feedback (validation, cleanup, imports) ([25821dd](https://github.com/misty-step/chrondle/commit/25821ddb043ab68cf9d77599adb37abe23070546))
- adjust performance test thresholds for CI environment ([c0c47bc](https://github.com/misty-step/chrondle/commit/c0c47bcb7a1110c93af2c2350e4c5e815a67cf5b))
- align archive pages and loading screens with archival aesthetic ([3ea3294](https://github.com/misty-step/chrondle/commit/3ea3294fc4d38e87aef4e046e86bdf33699d253d))
- allow year 0 as valid input in year validation ([17e662c](https://github.com/misty-step/chrondle/commit/17e662cf093e175e37abe8c96c842dcd5e549139))
- anonymous user state persistence across navigation ([1d1ca93](https://github.com/misty-step/chrondle/commit/1d1ca9358b191cce7bec5b83c5a724ac56f15bc7))
- apply linter formatting to validation script ([53473ea](https://github.com/misty-step/chrondle/commit/53473ea9028a566c98d32b04e0fd2bb3d035d547))
- apply the Carmack solution - make tests deterministic ([030f3d8](https://github.com/misty-step/chrondle/commit/030f3d89765bca8b3db2973d530677ce41b2c802))
- archive order game persistence + sentry/ui improvements ([a0a15bd](https://github.com/misty-step/chrondle/commit/a0a15bd15c092a6defc70312ecdd17933df1e76c))
- **backend:** calculate anonymous streak first day for proper combination ([1021dc2](https://github.com/misty-step/chrondle/commit/1021dc2ba3327d57e9d39c08caeaf2b0a4790b81))
- **backend:** guard streak updates with puzzle date to prevent archive gaming ([6d70308](https://github.com/misty-step/chrondle/commit/6d70308561b5af1b56de3ae6cb049b59db10dabe)), closes [#34](https://github.com/misty-step/chrondle/issues/34) [#7](https://github.com/misty-step/chrondle/issues/7)
- **backend:** reset streak on authenticated player loss and fix merge date logic ([b4603db](https://github.com/misty-step/chrondle/commit/b4603db8c78f2bdb303135810c631274d233bad9)), closes [#34](https://github.com/misty-step/chrondle/issues/34) [#34](https://github.com/misty-step/chrondle/issues/34)
- **backend:** use most recent date as tiebreaker for equal-length streak merges ([1541037](https://github.com/misty-step/chrondle/commit/15410379712c834a1502897a7d0cd8e1a2da643e))
- **backend:** use most recent date when combining consecutive streaks ([5d49adf](https://github.com/misty-step/chrondle/commit/5d49adf7a85707bfa9233d9ab6100f96ff9469c7)), closes [#34](https://github.com/misty-step/chrondle/issues/34)
- **ci:** add Convex codegen step to CI pipeline ([9c7a959](https://github.com/misty-step/chrondle/commit/9c7a959954ac3a1a1d2532cf891f9b1dd996bae2))
- **ci:** add required environment variables to build job ([c5cd678](https://github.com/misty-step/chrondle/commit/c5cd678dd2eba612c60f73be6e095db1431604ce))
- **ci:** exclude test publishable keys from secret scanning ([c270c34](https://github.com/misty-step/chrondle/commit/c270c347208a4c0769d159954031207f0d20ba42))
- **ci:** regenerate lockfile after bitcoin package removal ([9c07feb](https://github.com/misty-step/chrondle/commit/9c07febe550882353406280d58a300a8591935cc))
- **ci:** regenerate lockfile after bitcoin package removal ([#168](https://github.com/misty-step/chrondle/issues/168)) ([d242e76](https://github.com/misty-step/chrondle/commit/d242e76e9375f7eb49f3005992e376286cdf8cf5))
- **ci:** remove deprecated --prod flag from convex deploy ([02e34de](https://github.com/misty-step/chrondle/commit/02e34ded0663a9ab031f49bb3abf330c5b3e5181))
- **ci:** remove invalid --no-push flag from convex codegen command ([6967a64](https://github.com/misty-step/chrondle/commit/6967a64271004297642ff56deaf83b4b1b0018d0))
- **ci:** update Node.js to 22 for semantic-release compatibility ([e3b553d](https://github.com/misty-step/chrondle/commit/e3b553da252689a11efb35893d058c2c1532f6d9))
- **ci:** upgrade tar-fs to >=3.1.1 to resolve security vulnerability ([5af6ac0](https://github.com/misty-step/chrondle/commit/5af6ac0374b00c89acc34ae624a2274cc5b1c67c))
- **ci:** use step output for Sentry conditional instead of secrets ([86f3fcf](https://github.com/misty-step/chrondle/commit/86f3fcfe451d574b495101419409f667ce2ead45))
- clean up environment configuration and add deployment documentation ([a0bb626](https://github.com/misty-step/chrondle/commit/a0bb626cb1fb3eac0b633d3e6fb12c5a2bfa673e))
- complete merge blocker resolution and add project assets ([81509b9](https://github.com/misty-step/chrondle/commit/81509b94dd913bdb920de0e2d39dbf676f9473de))
- correct Convex API import path in Order archive page ([c318680](https://github.com/misty-step/chrondle/commit/c318680c0f3f6036a64ce58a0d5f9562f6132ad5))
- correct motion import path in EraToggle component ([b22ff40](https://github.com/misty-step/chrondle/commit/b22ff40660583619d9f0d3350d7fbc897c28226a))
- correct type annotation in debounced value test ([8e6e8cf](https://github.com/misty-step/chrondle/commit/8e6e8cfac37f2b7986b1c6e848d45e3ef013437b))
- correct typo in clearAllChrondleStorage import/usage ([c879e03](https://github.com/misty-step/chrondle/commit/c879e032e67043c8837081fde5e69a1b0ae2a555))
- critical bugs in puzzle completion persistence and timer ([0d7a435](https://github.com/misty-step/chrondle/commit/0d7a435e44a3e48efddfaa48f8f8b05077773424))
- critical P0 issues from PR [#61](https://github.com/misty-step/chrondle/issues/61) review + synthesize feedback to BACKLOG ([7bc4f72](https://github.com/misty-step/chrondle/commit/7bc4f72d1ee0eaa043da4a79a4f1fa6ed6c1043b)), closes [hi#priority](https://github.com/hi/issues/priority)
- dark mode contrast and hint panel text overflow ([6369bf0](https://github.com/misty-step/chrondle/commit/6369bf083ea1bdff111d6102c132199b7e77ceb3))
- **deps:** patch glob vulnerability GHSA-5j98-mcp5-4vw2 ([fb9fb66](https://github.com/misty-step/chrondle/commit/fb9fb66133a112c57627dea3438eff39f709843a)), closes [hi#severity](https://github.com/hi/issues/severity)
- eliminate awkward loading states and 'Game Over' button issue ([c6e16e0](https://github.com/misty-step/chrondle/commit/c6e16e0fe68b7ff86f86433ef8ebd7f63931ee05))
- eliminate hint duplication during animation demotion sequence ([72969a3](https://github.com/misty-step/chrondle/commit/72969a379536348cf943af8ca4b57e19bd845578))
- ensure all quality gates pass for CI readiness ([a54fd2c](https://github.com/misty-step/chrondle/commit/a54fd2c0a5ed45650636ecb45ecfc897c94ca67c))
- ensure CTA color consistency and eliminate button/alert conflicts ([1b602ae](https://github.com/misty-step/chrondle/commit/1b602ae761ac6cf3675e54bc327c2bf40074bc7b))
- event generation pipeline debugging and improvements ([fa76c71](https://github.com/misty-step/chrondle/commit/fa76c715ad529ec36800b427c95d3c834d17b563))
- export environment variables for Lighthouse CI server ([43858f1](https://github.com/misty-step/chrondle/commit/43858f1d94b679ce7804d351d838cdb08682d7cd))
- **frontend:** prevent anonymous streak loss on first-time sign-in + add optimistic updates ([239258e](https://github.com/misty-step/chrondle/commit/239258ef988b202f79cf1b130e2093dee455653d))
- **frontend:** resolve infinite render loop and stabilize streak updates ([9263adb](https://github.com/misty-step/chrondle/commit/9263adb9eb516c359692c13cf32978b3013ed58b))
- handle JSON parsing errors in historical context API ([7080ed6](https://github.com/misty-step/chrondle/commit/7080ed696cb67239452d8ef8e14b25f60ad89f1d))
- handle missing .env.local in CI environment ([36c013f](https://github.com/misty-step/chrondle/commit/36c013f231a18ca68b91a6c4e743b813e5d6602a))
- harden service worker registration ([87e6311](https://github.com/misty-step/chrondle/commit/87e63114a7ca742308d66a1c5c22bbd2cc502f0e))
- implement 5% minimum score floor for wide ranges ([#62](https://github.com/misty-step/chrondle/issues/62)) ([1b5fe1b](https://github.com/misty-step/chrondle/commit/1b5fe1b891956fbc924fdb4b51d50b10bc00474c))
- implement mobile viewport scrolling for all dialog components ([905c1d6](https://github.com/misty-step/chrondle/commit/905c1d6c91c16be3b8895d8973a5e0985b6ee92c)), closes [#16](https://github.com/misty-step/chrondle/issues/16) [#922](https://github.com/misty-step/chrondle/issues/922)
- implement restore-locked-positions pattern for anchor hints ([43a992c](https://github.com/misty-step/chrondle/commit/43a992c5f313a7f81dff16b3ab1f81444af9f011)), closes [#5](https://github.com/misty-step/chrondle/issues/5) [#3](https://github.com/misty-step/chrondle/issues/3) [#4](https://github.com/misty-step/chrondle/issues/4)
- implement Web Share API to resolve mobile share formatting issues ([ccde882](https://github.com/misty-step/chrondle/commit/ccde88263a9719953137675a0b1ffe869d62f14e))
- improve archive mobile styling and update project documentation ([8f7f971](https://github.com/misty-step/chrondle/commit/8f7f9716eaf65845d1061253192879c0cc9eebad)), closes [#7](https://github.com/misty-step/chrondle/issues/7)
- improve CI detection and increase performance thresholds ([7cdb7a9](https://github.com/misty-step/chrondle/commit/7cdb7a956eac41392e634c65a98f0d9b1c50aabd))
- improve error handling for missing environment variables ([6e7ea35](https://github.com/misty-step/chrondle/commit/6e7ea359e92d64a451a296af863121c00ecdfc1e))
- improve input focus management after guess submission ([6071356](https://github.com/misty-step/chrondle/commit/6071356a720ea13048c3c196b4da5be75b3ae368))
- improve share text UX and format ([8d378a2](https://github.com/misty-step/chrondle/commit/8d378a2fa8eeb8b6f811caff3ba9875e1a51ed4d))
- improve UI visibility and user experience ([0954ba9](https://github.com/misty-step/chrondle/commit/0954ba9f6f48cba86fe4b2de4de839d211937c3c))
- initialize Sentry client on app startup to prevent "not initialized" errors ([5b5ee42](https://github.com/misty-step/chrondle/commit/5b5ee429c5b141dc95f70ef8b7cfd6f241f6a12a))
- make archive page publicly accessible ([5062757](https://github.com/misty-step/chrondle/commit/5062757b3e5ade0990645bf3bc56ad8c25ae9390))
- make archive page resilient to auth failures ([c208bfc](https://github.com/misty-step/chrondle/commit/c208bfc601877df980787aa01e3e4eaed534e193))
- make footer visible by removing nested min-h-screen ([444e941](https://github.com/misty-step/chrondle/commit/444e9410516b6be2e561078d1b9fbeef73b50658))
- memoize debounced parameters to eliminate re-render loops ([1d28f51](https://github.com/misty-step/chrondle/commit/1d28f511c500b6c7a50e309c98cb60770e2614e7))
- move [@ts-expect-error](https://github.com/ts-expect-error) comments to correct line ([63261c1](https://github.com/misty-step/chrondle/commit/63261c1760464ad525d50539e30d39f58aa746c3))
- move Convex helper functions to lib/ to prevent deployment failure ([85c4e55](https://github.com/misty-step/chrondle/commit/85c4e5505ffbc611380ff01ab2b0183242cfeb04)), closes [#37](https://github.com/misty-step/chrondle/issues/37)
- move ConvexHttpClient initialization to runtime in Clerk webhook ([e93db95](https://github.com/misty-step/chrondle/commit/e93db9505eafbf6255083cd6a68023c23870a5d5))
- **perf:** memoize animation random values to prevent layout thrashing ([#154](https://github.com/misty-step/chrondle/issues/154)) ([19b62a9](https://github.com/misty-step/chrondle/commit/19b62a912d01ca05e69d95a55ca6435d804e273f)), closes [#115](https://github.com/misty-step/chrondle/issues/115) [#115](https://github.com/misty-step/chrondle/issues/115) [#FFD700](https://github.com/misty-step/chrondle/issues/FFD700)
- prevent auth state flip-flopping during Clerk-Convex handshake ([e4ac396](https://github.com/misty-step/chrondle/commit/e4ac396d65fdc1cd8e66d135d59952d6650fb302))
- prevent midnight rollover race in streak updates ([2a0d199](https://github.com/misty-step/chrondle/commit/2a0d1998188660b956bd283d5957ca704fa36821))
- prevent stuck loading state after abort in useHistoricalContext ([614dd20](https://github.com/misty-step/chrondle/commit/614dd203148e469ad1569288bd97bbc6cf885a7b))
- provide environment variables directly to Lighthouse CI server ([f2a1b8d](https://github.com/misty-step/chrondle/commit/f2a1b8d08380497214006f39609801f0fe9d4978))
- remove arrow key navigation to prevent game integrity violations ([102849b](https://github.com/misty-step/chrondle/commit/102849bfbc472265ebafb87b03c692e6496f340d))
- remove hint-giving features that undermine puzzle integrity ([9f89325](https://github.com/misty-step/chrondle/commit/9f893255c38ecbc373934bedbd1503d98e23d9e4))
- remove overengineered rate limiting infrastructure ([6fae774](https://github.com/misty-step/chrondle/commit/6fae774b521358fec83f1ed319594709f9a1891d))
- remove shebang from TypeScript test script ([c7e5ab8](https://github.com/misty-step/chrondle/commit/c7e5ab8bc43cd64e9a40f774c9ccd146ad9b6521))
- remove test:ci from pre-commit hooks to prevent hanging ([084adb5](https://github.com/misty-step/chrondle/commit/084adb5b5bde35cef22ab3ef6db8c3768e7ee380))
- remove tests from pre-push hook to avoid hanging issues ([6a8965c](https://github.com/misty-step/chrondle/commit/6a8965c464c5767ebcd0e8cb44f30e40dfe01cb4))
- remove unused Badge import ([ca6b895](https://github.com/misty-step/chrondle/commit/ca6b8953dc7602ae668f3eb5eeb2e7838e92774b))
- remove unused handleHintClick function ([551d657](https://github.com/misty-step/chrondle/commit/551d657a0a4f6488b7f46f485324267a9dae026b))
- REMOVE WEBHOOK SECRET FROM TODO.md ([952351d](https://github.com/misty-step/chrondle/commit/952351d754962850dc7187a89919c6088cdc8438))
- replace AbortSignal.timeout() with cross-platform AbortController ([7aa53b7](https://github.com/misty-step/chrondle/commit/7aa53b7f9bdc920b8c756e165d5092d0722b4fb3))
- replace parallel badge updates with atomic gist update ([8319e98](https://github.com/misty-step/chrondle/commit/8319e982eeec4971ff26a001f45a9ff4895b93ad))
- replace synthetic performance tests with meaningful metrics ([bd7c4d3](https://github.com/misty-step/chrondle/commit/bd7c4d3fe1215ae2ae0d33b393dbf30678c5cf1c))
- resolve [@size-limit](https://github.com/size-limit) transitive security vulnerabilities ([e81b787](https://github.com/misty-step/chrondle/commit/e81b787817767e8e9dc46f646377578acc656993))
- resolve archive page crash by limiting computation to current page only ([cf8d77d](https://github.com/misty-step/chrondle/commit/cf8d77d346f2b9293b0544cf8cd174e305b55f29))
- resolve archive page performance crash with pagination and memoization ([5960ba0](https://github.com/misty-step/chrondle/commit/5960ba0545756b687946d8783d7cf4b249b90788))
- resolve archive puzzle hint duplication and improve system design ([7158013](https://github.com/misty-step/chrondle/commit/71580131d30542bc5106e2d8fbdd81c78aec8bcf))
- resolve archive puzzle infinite loading issue ([0308dec](https://github.com/misty-step/chrondle/commit/0308decc7eef887fb033f66c34cf29a1697c5105))
- resolve archive puzzle issues and consolidate layout ([6274748](https://github.com/misty-step/chrondle/commit/62747487495b3b583b9270a608060f1965e465ba))
- resolve archive puzzle system errors and remove unsupported routes ([1f4a1ab](https://github.com/misty-step/chrondle/commit/1f4a1ab8f35fb9895c3405bcef0dc294496f26f5))
- resolve auth domain mismatch and React infinite loop ([9cd5d9b](https://github.com/misty-step/chrondle/commit/9cd5d9b29566698ad79d5a68eea3de9b17c7bbd8))
- resolve build errors for archive feature ([1377218](https://github.com/misty-step/chrondle/commit/137721892e70970c84f05986c7403bda4b20f92d))
- resolve build errors in Convex integration ([6551d98](https://github.com/misty-step/chrondle/commit/6551d9811a8d41dc5cd3bcdba6523359fb0b6207))
- resolve CI failures - timezone and local action issues ([36654f9](https://github.com/misty-step/chrondle/commit/36654f92f67cc97517aad1fa65d78c8bb56c6848))
- resolve CI pipeline failures by adjusting performance test thresholds ([5ad190b](https://github.com/misty-step/chrondle/commit/5ad190bdbfe18c4a10b7fa4a7971fc7322dc759c))
- resolve CI security check failures ([ac4354f](https://github.com/misty-step/chrondle/commit/ac4354f6f04e75baf5c4f5137295436a158b8982)), closes [#18](https://github.com/misty-step/chrondle/issues/18)
- resolve CI test failures and delete legacy puzzles.json ([c7d2ff2](https://github.com/misty-step/chrondle/commit/c7d2ff2af25ec29fa17d09ec6c37fcf16f75295a))
- resolve CI test failures for BC/AD input feature ([2e25b73](https://github.com/misty-step/chrondle/commit/2e25b73a7265ff08ef7b855cb4d8e18127daec75))
- resolve CI test failures with Node.js 20 upgrade and PostCSS fix ([35b97cd](https://github.com/misty-step/chrondle/commit/35b97cdea683e3da34e4ecc48779372c4d8ae887))
- resolve countdown timer issues and improve development workflow ([a86a117](https://github.com/misty-step/chrondle/commit/a86a117771c7e85cae286c38c19c11794028744e))
- resolve critical AI Historical Context merge blockers ([f464c59](https://github.com/misty-step/chrondle/commit/f464c596dbcbd2beb88e38c00c54f4e93746305f))
- resolve critical merge-blocking issues from code review ([dd3a7f1](https://github.com/misty-step/chrondle/commit/dd3a7f1a59566afe320568f151406b3305ebac14))
- resolve critical production deployment issues ([8033e58](https://github.com/misty-step/chrondle/commit/8033e58c3dd60be6616564237ec74d76ddd4c2cb))
- resolve critical puzzle completion bug and improve project organization ([01af94f](https://github.com/misty-step/chrondle/commit/01af94fc29a29f500a41787fa06514e94b6947d6))
- resolve CSS parsing error with utility class syntax ([9c71fee](https://github.com/misty-step/chrondle/commit/9c71fee480cea78e1b76cd3910714fe8dea06d35))
- resolve ESLint warning in GuessInput useEffect dependencies ([5b743d0](https://github.com/misty-step/chrondle/commit/5b743d0c652a4826c9d01f3395b28d40e5e980a6))
- resolve glob security vulnerability in dev dependencies ([946b688](https://github.com/misty-step/chrondle/commit/946b68896eab98b26eec10adec48204702beac7b))
- resolve HintsDisplay test failures and update test expectations ([f84b1ee](https://github.com/misty-step/chrondle/commit/f84b1ee0d869e5203ef92a1264872235620f3175))
- resolve hydration mismatches and standardize victory confetti ([6c28335](https://github.com/misty-step/chrondle/commit/6c283359b2e45dd813d050e3967e2ecdb2e509d3))
- resolve linting issues and remove problematic test ([957abfa](https://github.com/misty-step/chrondle/commit/957abfa719b4631e7a8cf126afa9614d1bdcdc29))
- resolve mobile submit button and add puzzle hints to game over ([3beb422](https://github.com/misty-step/chrondle/commit/3beb422afcc8a60b549c55946f4f653188493a92))
- resolve mobile UX bugs and update test coverage ([49287f3](https://github.com/misty-step/chrondle/commit/49287f36eddde9b5dd9ff3a2c9752774640345a8))
- resolve Next.js 15 async params TypeScript error ([e3101de](https://github.com/misty-step/chrondle/commit/e3101de8faea8229632fccc587beee0c7d1049f9))
- resolve order puzzle ID mismatch causing broken drag-and-drop in archive ([7c08872](https://github.com/misty-step/chrondle/commit/7c08872d309db2ae2853a937189e63c07eb387bc))
- resolve PR review feedback - critical fixes and CSS rename ([378338c](https://github.com/misty-step/chrondle/commit/378338c8fab9c6f1296aba411e57dcfb3f50d4c5))
- resolve PR review feedback for containment and test ([4c45999](https://github.com/misty-step/chrondle/commit/4c45999c94ab48bbc527cd64969c6edb28afb5ad))
- resolve pre-push hook hanging issue with custom test runner ([cc42b3a](https://github.com/misty-step/chrondle/commit/cc42b3ab01434eb511da9936f86093380b658cf0))
- resolve production deployment CSP and Convex configuration issues ([496a2db](https://github.com/misty-step/chrondle/commit/496a2dbed3fd0aac7858c77d92be518c84b51c6b))
- resolve puzzle number display and user data loading issues ([78abf52](https://github.com/misty-step/chrondle/commit/78abf527d497b3e7f839fdd0a5f208150d33938b)), closes [#1](https://github.com/misty-step/chrondle/issues/1)
- resolve streak counter timezone issues ([5c90965](https://github.com/misty-step/chrondle/commit/5c9096552acc4a4023260ed841e0b6e905ae5986))
- resolve test suite hanging issue and implement monitoring improvements ([2244161](https://github.com/misty-step/chrondle/commit/22441613b27cc3a6c4a3eb01d85e2fd4358d670e))
- resolve TypeScript compilation errors in test files ([9fe2ffd](https://github.com/misty-step/chrondle/commit/9fe2ffd13e4883db0ff625b9ffe932795b3f3122))
- resolve TypeScript errors and failing tests ([c5248c2](https://github.com/misty-step/chrondle/commit/c5248c2b8c88402fcbccc409a48ce3b7f96830fd))
- resolve TypeScript errors in HintsDisplay tests ([289e9d0](https://github.com/misty-step/chrondle/commit/289e9d044fc71d12194f8816c0fd73fe81ce50d1))
- resolve TypeScript errors in updatePuzzleStats helper ([52e8a1f](https://github.com/misty-step/chrondle/commit/52e8a1f6e4c5642b88caf8abf22287aaf20e56d8))
- resolve vitest alias conflict for convex imports ([6ef00e8](https://github.com/misty-step/chrondle/commit/6ef00e8be597bd7fb8d249b284abfdcd6e17d4a7))
- resolve Web Share API fallback chain and test infrastructure ([f335b26](https://github.com/misty-step/chrondle/commit/f335b265f09e8f1ebe6ce3d22ce3bf8814798b90))
- resolve Web Share API merge blockers ([69be1d3](https://github.com/misty-step/chrondle/commit/69be1d385c22d0dfa87d5e868d3096a1f03a3349))
- restore bright white navbar and complete editorial contrast system ([450d3c0](https://github.com/misty-step/chrondle/commit/450d3c021a1c75066fe0a3ec19437631d589c2c6))
- restore events api and workflow ([d1b5c9f](https://github.com/misty-step/chrondle/commit/d1b5c9fede48d015c32b30cf6d3cfccb0ff09311))
- restore historical context generation feature ([70f36c7](https://github.com/misty-step/chrondle/commit/70f36c786fc700e384c6c7693454fef1dab853e3))
- restore light mode texture visibility with mode-aware colors ([7eb1a1b](https://github.com/misty-step/chrondle/commit/7eb1a1b482e2e8e66bc42a488e70259ba64c2407)), closes [#000000](https://github.com/misty-step/chrondle/issues/000000) [#FFA857](https://github.com/misty-step/chrondle/issues/FFA857)
- restore screen reader announcements after Puzzle refactor ([27f2425](https://github.com/misty-step/chrondle/commit/27f2425290b66b175d12984967e857573a66aad0))
- restore Timeline component to display full historical range (2500 BC - current year) ([9ebc38c](https://github.com/misty-step/chrondle/commit/9ebc38c866142cb71b7a91170b5e564a969593a4))
- restore Web Share API for mobile to prevent URL encoding ([b5efe95](https://github.com/misty-step/chrondle/commit/b5efe95877abbf379972ff36a0444c464476cd41))
- **scoring:** correct hint validation error message and add test coverage ([6a960be](https://github.com/misty-step/chrondle/commit/6a960be3bb0309f26893aafbf24a24e4fd315866))
- **scripts:** make verify-deployment CI-friendly ([ecaa91d](https://github.com/misty-step/chrondle/commit/ecaa91d22849d78a402b0032b25fe3a490e80e03))
- **security:** add comprehensive validation for anonymous streak data ([1676949](https://github.com/misty-step/chrondle/commit/16769490d03c1a971c15cb21a7dbc522d314879e)), closes [#4](https://github.com/misty-step/chrondle/issues/4) [#34](https://github.com/misty-step/chrondle/issues/34)
- **security:** derive userId from auth context in submitGuess/submitRange ([#137](https://github.com/misty-step/chrondle/issues/137)) ([0687b26](https://github.com/misty-step/chrondle/commit/0687b26781743bf0e6c3e8f065db3ad424f9dfd4)), closes [#91](https://github.com/misty-step/chrondle/issues/91)
- **security:** prevent user pre-registration attack via public mutation ([#150](https://github.com/misty-step/chrondle/issues/150)) ([9e1ee74](https://github.com/misty-step/chrondle/commit/9e1ee744933935f86278ac157a1d923146ff1562)), closes [#92](https://github.com/misty-step/chrondle/issues/92)
- **server:** add graceful env var handling for Convex client ([1b6ebc1](https://github.com/misty-step/chrondle/commit/1b6ebc12cace140afa363693ca6af9b1d66b07ae))
- simplify CSP configuration for Lighthouse CI ([d2268df](https://github.com/misty-step/chrondle/commit/d2268dff380b78a6253f1007b93be4cced1776ac))
- simplify to UTC and add on-demand puzzle generation ([c2673e1](https://github.com/misty-step/chrondle/commit/c2673e19b6067a9259a412c0a4993d956618f241))
- simplify Vercel build configuration ([89f45aa](https://github.com/misty-step/chrondle/commit/89f45aa775ec8b06a33c6ff9d51086bacfda6b54))
- skip Convex validation when URL not set in CI ([8251726](https://github.com/misty-step/chrondle/commit/82517265e1dfb8e63d1db5eb3c165f7f327d6644))
- skip env validation during build/SSG (deep module approach) ([891df1e](https://github.com/misty-step/chrondle/commit/891df1eb49acf3249e4ee236c5e792439c2bc7d6))
- skip timezone-dependent tests in CI environment ([426dc98](https://github.com/misty-step/chrondle/commit/426dc986510544bff1c90b825bf9a0d72cff4d44))
- smooth order drag interactions ([7f65a40](https://github.com/misty-step/chrondle/commit/7f65a400416c74d5443d1a0702a8e929ae025c32))
- stabilize notification permission flow ([2a84b9a](https://github.com/misty-step/chrondle/commit/2a84b9a607ff42e37d39127c7567b1f5721d55c0))
- stabilize useDebouncedValues with explicit memoization contract ([7eca46d](https://github.com/misty-step/chrondle/commit/7eca46d06d4f981349110d15e73adcd2780c2878))
- standardize timeline UI and remove victory-state styling inconsistencies ([ed18ff5](https://github.com/misty-step/chrondle/commit/ed18ff5f3fed71562b0a15e3c5a423cdc056dbe1))
- strengthen date validation in anonymous streak merge ([f1e5ec8](https://github.com/misty-step/chrondle/commit/f1e5ec8c09fc92ac6df0d21897be003544bf067a)), closes [#37](https://github.com/misty-step/chrondle/issues/37)
- **stripe:** resolve webhook 307 redirect breaking subscription sync ([#147](https://github.com/misty-step/chrondle/issues/147)) ([ac68c8e](https://github.com/misty-step/chrondle/commit/ac68c8e4285198945bd6923b827966e26548f7f2))
- **test:** increase circuit breaker cooldown for CI reliability ([789c423](https://github.com/misty-step/chrondle/commit/789c423bc4ab4db316f0e5307d64f5ef60ca927c))
- update CI security check to detect actual secrets instead of variable names ([26248cb](https://github.com/misty-step/chrondle/commit/26248cb4dd117c7332e3c7adb5578718ec713e7e))
- update coverage thresholds to meaningful values ([03e1731](https://github.com/misty-step/chrondle/commit/03e1731be94b7a8916f583f102b13425884464f5))
- update Next.js to 15.5.3 to resolve security vulnerabilities ([3d03c4a](https://github.com/misty-step/chrondle/commit/3d03c4a960a138143c0d0333904f97fb8f7a76fb))
- update pnpm-lock.yaml to match pinned dependencies ([c26f8d2](https://github.com/misty-step/chrondle/commit/c26f8d21d900776e66902163c910f81b7f8eecfc))
- update tests for new BC/AD toggle integration ([db058c1](https://github.com/misty-step/chrondle/commit/db058c10e2703b19e483581a8c053e3ce3f6b743))
- update vitest to resolve esbuild security vulnerability ([f6ea23e](https://github.com/misty-step/chrondle/commit/f6ea23e98840d3fa8e9609e38668be1b19a6c036))
- upgrade Sentry to 10.27.0 to patch header leak vulnerability ([c95684c](https://github.com/misty-step/chrondle/commit/c95684c6b238c3ab859528ccd3b3fa0e54a65517))
- use regular tests instead of coverage in CI ([6036522](https://github.com/misty-step/chrondle/commit/60365220cd06cc861805bc71301258a43c77aa20))
- use timezone-corrected puzzle in GameIsland, filter archive by local date ([#87](https://github.com/misty-step/chrondle/issues/87)) ([a5d3e62](https://github.com/misty-step/chrondle/commit/a5d3e62704798f74d183a2f79dc46906a4b57c09)), closes [#134](https://github.com/misty-step/chrondle/issues/134)
- use Vitest fake timers for proper Date mocking in gameState tests ([80f7cf4](https://github.com/misty-step/chrondle/commit/80f7cf4b1a3cbf945a3efc027a4ac05dbce42c1a))
- **ux:** show validation errors for out-of-range year inputs ([#140](https://github.com/misty-step/chrondle/issues/140)) ([0bcd022](https://github.com/misty-step/chrondle/commit/0bcd022a1aa3bd172a4b11d58722a2a3a9e96afb)), closes [#97](https://github.com/misty-step/chrondle/issues/97) [#97](https://github.com/misty-step/chrondle/issues/97)
- **vercel:** add Convex codegen to Vercel build command ([0c69495](https://github.com/misty-step/chrondle/commit/0c694959b096f65c0c02f193007e25237e3c7697))
- **vercel:** restore Convex generated files and add regression prevention ([34db80c](https://github.com/misty-step/chrondle/commit/34db80c786360ce2ff7ca8bb94a6cf38a1cf6a16))

### Code Refactoring

- organize documentation and fix test hanging ([1b789bc](https://github.com/misty-step/chrondle/commit/1b789bc73c45eb6be44973a9e5c7035ef0f43d87))

### Features

- add animated theme toggle to navbar with delightful transitions ([9e44b1d](https://github.com/misty-step/chrondle/commit/9e44b1d17241bf4344a41e95b53c74957e6fae7f))
- add BC/AD input toggle with feature flag and comprehensive testing ([70dc618](https://github.com/misty-step/chrondle/commit/70dc61838449b2fd75c37fa9b4f298185bff5a93))
- add BitcoinModal component with QR code and copy functionality ([8d1aaf4](https://github.com/misty-step/chrondle/commit/8d1aaf4d7bcc176813d729319b76248f3ddafb45))
- add bundle size tracking with PR comments ([b094ab4](https://github.com/misty-step/chrondle/commit/b094ab4ad54a2057a8f616465e67ecb45acda161))
- add celebratory confetti animation for victory state ([92e5478](https://github.com/misty-step/chrondle/commit/92e54784c9abbc1493071b04ae0a7b4ca78d79fa))
- add comprehensive Convex DB integration plan ([0052776](https://github.com/misty-step/chrondle/commit/005277608580e8de15181eab094f66574c8c6231))
- add config builders for dual-mode API support ([36d04ab](https://github.com/misty-step/chrondle/commit/36d04ab2a9185f884ba35dc26001449b89fc2356))
- add Convex observability wrapper and apply to order submission ([1189184](https://github.com/misty-step/chrondle/commit/1189184dc9bd9514438d75c60b1521afe423b4cc))
- add critic agent ([2628cc9](https://github.com/misty-step/chrondle/commit/2628cc975d645d76691d0ce0a85bc4c9d0f5ec8f))
- add cross-device sync indicator and fix auth improvements ([baf1a08](https://github.com/misty-step/chrondle/commit/baf1a08fc3298367c8f7ec8e585cae99a0e5fb41))
- add daily event generation cron ([3f25849](https://github.com/misty-step/chrondle/commit/3f25849ea68a54da8587868bcb7858e4bc280e9b))
- add dark mode support to GamesGallery with integrated theme toggle ([4eed94f](https://github.com/misty-step/chrondle/commit/4eed94fa3a9d1ae2303fb13f4f5e33624e38f84c))
- add deriveOrderGameState ([ef3b557](https://github.com/misty-step/chrondle/commit/ef3b557aeb81a3e6a0066021beae0a5ef431a71e))
- add deterministic order hints ([174791c](https://github.com/misty-step/chrondle/commit/174791c0e3f6d934c8d51f254e359b3f2f4da966))
- add display formatting utilities and localStorage migration ([b2ad25e](https://github.com/misty-step/chrondle/commit/b2ad25ecc7aca4266dbb06bd8783714d13c1c743))
- add DraggableEventCard component ([fdaa205](https://github.com/misty-step/chrondle/commit/fdaa205d374438b67c570ad5c8990e824f003257))
- add environment variable verification to CI pipeline ([ca9a5a9](https://github.com/misty-step/chrondle/commit/ca9a5a949fb93f0297c645c7b92e6a0d614149c4))
- add error boundaries to archive routes for improved stability ([36cdf66](https://github.com/misty-step/chrondle/commit/36cdf66c5bc9e3b84a8fab12bcae35e740c6119f))
- add generation log mutations and queries ([4d50727](https://github.com/misty-step/chrondle/commit/4d50727898da564d648d8172d3bf37ed98cf5fc0))
- add generation_logs table for event pipeline monitoring ([bb26597](https://github.com/misty-step/chrondle/commit/bb26597a01b9de708d35e668496ad62c66ec3b24))
- add generator action ([29a833b](https://github.com/misty-step/chrondle/commit/29a833bcb3ecb36fdb229a0c6e677099367394c2))
- add graceful error handling for missing environment variables ([2620bc0](https://github.com/misty-step/chrondle/commit/2620bc0a41e63193a143cf6ad9910194b807fe5f))
- add header mode switcher ([aa7b465](https://github.com/misty-step/chrondle/commit/aa7b465101a9da66a4a3cd08da12aa02fc1e301a))
- add hint generation module ([438f75a](https://github.com/misty-step/chrondle/commit/438f75a4c5025d3c6239f0a1ed0b9579c0c79ea4))
- add hint ladder component ([27b6c01](https://github.com/misty-step/chrondle/commit/27b6c01d6746d98fb0fee4c3505c4b92611d15e4))
- add HintDisplay component ([53c472b](https://github.com/misty-step/chrondle/commit/53c472becf6e905206620d13e3279241a9c92ddc))
- add llm circuit breaker ([f6484eb](https://github.com/misty-step/chrondle/commit/f6484eb93fcaf5fd1ad5f3674994a1a355916670))
- add markdown rendering for historical context ([5534a0c](https://github.com/misty-step/chrondle/commit/5534a0cf0f8412f6cb6bfd5b7a4c028b12ccd3e7))
- add monitoring alerts ([d8f691b](https://github.com/misty-step/chrondle/commit/d8f691b79ae373a7b2bdd21c3d264a0b5ee8df60))
- add monitoring queries ([252d72a](https://github.com/misty-step/chrondle/commit/252d72a31debda48909fca9a21c605a991e84875))
- add Open Graph and Twitter Card meta tags ([#135](https://github.com/misty-step/chrondle/issues/135)) ([343cc40](https://github.com/misty-step/chrondle/commit/343cc40dea98725041cf47230543ce70e6192a45)), closes [#129](https://github.com/misty-step/chrondle/issues/129) [#129](https://github.com/misty-step/chrondle/issues/129)
- add Order game state types ([5ed1fea](https://github.com/misty-step/chrondle/commit/5ed1fea021c07fe40c9e8d886301e6eae9880604))
- add Order hint generators ([cf0a42b](https://github.com/misty-step/chrondle/commit/cf0a42bdb4811da5881fd6d0250b1c668ec12766))
- add order mode Convex schema ([5d8d3bf](https://github.com/misty-step/chrondle/commit/5d8d3bfbf5c0cffb96fbe99c20b42dab86aa6c4a))
- add Order mode page ([88f056e](https://github.com/misty-step/chrondle/commit/88f056e6fb3207cfa5d505abcb9e5d0d7d44a52c))
- add Order mode submission error handling with toast feedback ([d565a16](https://github.com/misty-step/chrondle/commit/d565a16e196039cbe0feca0fc337664751b36bf2))
- add Order puzzle cron generation ([160a83b](https://github.com/misty-step/chrondle/commit/160a83b87b00829c4545c7ef564d16cb44390a49))
- add Order puzzle queries ([656d377](https://github.com/misty-step/chrondle/commit/656d3773d2f5d1b66c777c6920bfec08f29b7c98))
- add Order reveal animations ([8925a0c](https://github.com/misty-step/chrondle/commit/8925a0cd1171f0757916d9e544dbeb081fe6917c))
- add Order scoring module ([26f5552](https://github.com/misty-step/chrondle/commit/26f5552423a822d775530a6e0b957774cc83ec3c))
- add Order share card generator ([836692c](https://github.com/misty-step/chrondle/commit/836692c3505f09ac39ded03f579a08f85b926650))
- add Order submit mutation ([ad37a78](https://github.com/misty-step/chrondle/commit/ad37a78d841be743dffbafadcecca64d9c2abbdf))
- add OrderEventList ([550b82f](https://github.com/misty-step/chrondle/commit/550b82f9be95f7b3b4af3c01aedf22af1bc970cb))
- add OrderReveal component ([57699be](https://github.com/misty-step/chrondle/commit/57699be613f8b0cccea70def6a030be926d11843))
- add philosophy alignment analysis and improvement tasks to backlog ([b2d5851](https://github.com/misty-step/chrondle/commit/b2d5851917400360fe6430548bdd1a436d806a61))
- add pipeline orchestrator ([01f81a8](https://github.com/misty-step/chrondle/commit/01f81a87f0e421def935684b9e89a2f40d305da9))
- add Playwright MCP server configuration ([ef9d8a3](https://github.com/misty-step/chrondle/commit/ef9d8a342a1e36942cfc8af88b72dc5e65ef96c8))
- add production authentication verification system ([33d0b56](https://github.com/misty-step/chrondle/commit/33d0b5697ad38674a83b438faa4e6ebcee829f10))
- add provider-agnostic llm client ([ca5bdb8](https://github.com/misty-step/chrondle/commit/ca5bdb818676380d80443e688747287ee6a6303e))
- add proximity display to Classic loss share messages ([#86](https://github.com/misty-step/chrondle/issues/86)) ([a052d34](https://github.com/misty-step/chrondle/commit/a052d345050c52b3bf2137988faba9d45e833301))
- add Puzzle Judge for intelligent hint ordering ([#127](https://github.com/misty-step/chrondle/issues/127)) ([48feee2](https://github.com/misty-step/chrondle/commit/48feee299209e3cdc6520367cfd38f0c34bffb6b))
- add quality metrics dashboard script ([f9c6aca](https://github.com/misty-step/chrondle/commit/f9c6aca0f636a70965c6392f1ef2958b32d86df0))
- add range preview component ([91098b5](https://github.com/misty-step/chrondle/commit/91098b5862d90e23433e4e4f05596215f1a7ea7c))
- add range slider component ([81cd4ac](https://github.com/misty-step/chrondle/commit/81cd4ac66ed62e767718d395ebed6825e5649d6a))
- add range submission actions ([c153037](https://github.com/misty-step/chrondle/commit/c153037b4d2432904f64e2a04284164bb292c409))
- add range submission mutation ([3e40e64](https://github.com/misty-step/chrondle/commit/3e40e64cc492c373d4e8b2784e6ac822c21b199e))
- add releases page ([30228a6](https://github.com/misty-step/chrondle/commit/30228a6cab4dd77ce478adb56223c560a633c046))
- add response type interfaces for dual-mode API support ([9ed7603](https://github.com/misty-step/chrondle/commit/9ed7603a9d6a77ecd762cb53caf39ebb32405596))
- add reviser agent ([c22ac77](https://github.com/misty-step/chrondle/commit/c22ac77584224d434271fc6df4d11ad42d132502))
- add robust query parameter validation for archive page ([05326ae](https://github.com/misty-step/chrondle/commit/05326ae12851f821da453a7818aa911cfd092235))
- add scoring module ([d1adc5b](https://github.com/misty-step/chrondle/commit/d1adc5bfa73dbf467a5ea2705196f18b30576ad9))
- add Sentry observability bootstrap modules ([b609747](https://github.com/misty-step/chrondle/commit/b609747eb8737d5d25022e4e45a0bbfab86bacf4))
- add Sentry release and sourcemap upload to deploy workflow ([7660f31](https://github.com/misty-step/chrondle/commit/7660f31b4253ffd5ee080758434afa639e821c32))
- add shadcn/ui component library ([091dda3](https://github.com/misty-step/chrondle/commit/091dda34b3ec108fe2c1442317dea280486c6dbe))
- add shadcn/ui components and enhanced tooling configuration ([c4fcd93](https://github.com/misty-step/chrondle/commit/c4fcd932102448c96dc7b254a8b803ecfa05c3d3))
- add smart homepage routing ([ef26821](https://github.com/misty-step/chrondle/commit/ef2682183f22fcbd85ecba0541ee0ff20e8c64cd))
- add smooth HintsDisplay layout animations with ANTICIPATION easing ([ce493d4](https://github.com/misty-step/chrondle/commit/ce493d4989ee8b02f6faefc69a729f9003328693))
- add smooth Timeline marker animations with spring physics ([a43b831](https://github.com/misty-step/chrondle/commit/a43b8315e0337cfa550f01bdc64973a7498f424e))
- add staggered order reveal animation ([21f8f23](https://github.com/misty-step/chrondle/commit/21f8f23bdb44c01814fdff91dc7c5f9f9c082966))
- add staggered reveal animation to ProximityDisplay ([2d31551](https://github.com/misty-step/chrondle/commit/2d31551e03e98753f2efbbd5262c2e862b2d0c00))
- add strict year validation for archive routes ([5df5c31](https://github.com/misty-step/chrondle/commit/5df5c31b1e2e1bb056ec20e518b0b9946ea3e7f6))
- add structured development command workflows ([17b9105](https://github.com/misty-step/chrondle/commit/17b9105a90c6da0bcccd02943045fa111031aa19))
- add structured error logging ([78403f2](https://github.com/misty-step/chrondle/commit/78403f29751daf54e42671bddca9178e0168e0fc))
- add test coverage reporting to CI pipeline ([9a81f86](https://github.com/misty-step/chrondle/commit/9a81f868ee8e04823c9ddc3190b3bd12e48da30e))
- add type-safe PuzzleType classification for streak business rule ([ca6b657](https://github.com/misty-step/chrondle/commit/ca6b657d0d478db8c8d34f822a3bfc9006777d2e))
- add useHints hook ([5879207](https://github.com/misty-step/chrondle/commit/587920734f5047f8ce64386cec40815c18ce95f7))
- add useOrderGame hook ([474a698](https://github.com/misty-step/chrondle/commit/474a698a425ac5f0221ac739e472a2fd49c7f263))
- add Vercel configuration for Convex deployment ([66c0bb0](https://github.com/misty-step/chrondle/commit/66c0bb0afa011a948d40f7baed035c64ddfa333d))
- add work selector action ([294e325](https://github.com/misty-step/chrondle/commit/294e325167b0c762559cc3dffac77d9ccb06ccf6))
- align main content width with navbar ([6dc5e3c](https://github.com/misty-step/chrondle/commit/6dc5e3cc698494d39043731d504fbd3ba0834eb3))
- align navbar and main content width, consolidate completion layout ([58d27d0](https://github.com/misty-step/chrondle/commit/58d27d06d3ca455adc9a761be078b6e92114812f))
- **analytics:** migrate from Vercel Analytics to PostHog ([#163](https://github.com/misty-step/chrondle/issues/163)) ([714dcdf](https://github.com/misty-step/chrondle/commit/714dcdf16dd924b3c272fbfd5904e5df427d9965))
- archival night reading mode with design philosophy principles ([dc98fde](https://github.com/misty-step/chrondle/commit/dc98fde38321b1be7617dca0c4a32fb31d7b9f5f))
- automated changelog and release infrastructure ([#159](https://github.com/misty-step/chrondle/issues/159)) ([09c92fe](https://github.com/misty-step/chrondle/commit/09c92feb7a45f3da864c957ba9a8aa212cbb48dc))
- **backend:** add lastCompletedDate field to users schema ([b3a4fc4](https://github.com/misty-step/chrondle/commit/b3a4fc4443582364744b2e60d65f1c0284cac2e8))
- **backend:** add mergeAnonymousStreak mutation ([a9c909d](https://github.com/misty-step/chrondle/commit/a9c909d201e2a0dc678fec50c096a0ada0c4731b))
- **backend:** add pure streak calculation utility ([f83a8ba](https://github.com/misty-step/chrondle/commit/f83a8babb9756ad37ff197e31208878ee3ae96b7))
- **backend:** add streak updates to submitGuess mutation ([82bf47f](https://github.com/misty-step/chrondle/commit/82bf47fc1f1a85b9f38a1d6811defe3c849577fc))
- build interactive order hints panel ([979d6ed](https://github.com/misty-step/chrondle/commit/979d6edea7b00f4ac81bb104172718d009993e4b))
- build range input composite ([8142d32](https://github.com/misty-step/chrondle/commit/8142d32dd13ca6c27075bb348b05acf53c94fbef))
- complete Chrondle migration to Next.js 15 + TypeScript ([d438f77](https://github.com/misty-step/chrondle/commit/d438f77764d953202f2f8615d329d84e441a8f57))
- complete CI improvements and error handling for BC/AD feature ([2ac8ff2](https://github.com/misty-step/chrondle/commit/2ac8ff20457187492060192f64b5cff2ec11c7f3))
- complete codebase simplification tasks - extract API functions and remove deprecated code ([585ba22](https://github.com/misty-step/chrondle/commit/585ba220418388948d8dfb0589716b426fba15df))
- complete component cleanup and storage consolidation ([26303b7](https://github.com/misty-step/chrondle/commit/26303b765b60ce834bb692bb6bbe928f3f1758d1))
- complete Convex integration with authentication and user features ([5e47fbc](https://github.com/misty-step/chrondle/commit/5e47fbce4ed0e166b64e1a1d80122d9d0b47f8b3))
- complete Convex migration - remove localStorage and legacy code ([04d2b0e](https://github.com/misty-step/chrondle/commit/04d2b0e20c3f8ae97530f40381ddd9e6e30d4d10))
- complete Convex migration automation and deployment infrastructure ([735b110](https://github.com/misty-step/chrondle/commit/735b1102b107f112c25e2eff5f495b7bfc99719e))
- complete GPT-5 migration with data regeneration ([fb03f25](https://github.com/misty-step/chrondle/commit/fb03f25cf8b652f5fb0f8aa846fc22bcc6771624))
- complete Month 3 UX enhancement implementation ([b165c12](https://github.com/misty-step/chrondle/commit/b165c125365dff03920ea80d7d621b0a293930d6))
- complete Phase 1 & 2 of Convex migration ([45b23bc](https://github.com/misty-step/chrondle/commit/45b23bca4ff6a112330775dee5cf2c46497c6b9a))
- complete server-first architecture migration ([e67e04f](https://github.com/misty-step/chrondle/commit/e67e04f04e680fd7d921bcfd2265ab458cca5263))
- complete server-side historical context generation system ([08ee80b](https://github.com/misty-step/chrondle/commit/08ee80b7c4a624daf75498a02ca2e11f4146a44f))
- complete Tailwind v4 semantic token migration ([d77c2af](https://github.com/misty-step/chrondle/commit/d77c2af7e97b003b09bf943a0962f9156000c108))
- completely redesign game completion experience ([3c58501](https://github.com/misty-step/chrondle/commit/3c58501465fbac5df1a2d90b94f115542deea63a))
- comprehensive archival aesthetic polish and design system refinement ([f45f603](https://github.com/misty-step/chrondle/commit/f45f60363856e887e70bee2edef53997993ea349))
- comprehensive UI/UX enhancements and event management improvements ([b9e45e2](https://github.com/misty-step/chrondle/commit/b9e45e2b06ee9cc5ed85b37c203b4fd351439ff7))
- create canonical Puzzle interface with consistent naming ([e4ba2ab](https://github.com/misty-step/chrondle/commit/e4ba2ab23b07b72e7224e80849a8a8f78b21df32))
- derive range-aware game state ([1580f71](https://github.com/misty-step/chrondle/commit/1580f713e0ec04331c4ba5e395f6ea18b6f5ce7f))
- enable jsx-a11y ESLint plugin for accessibility linting ([e3e83a1](https://github.com/misty-step/chrondle/commit/e3e83a1a62080b1600a7a04c88b82eaf5e7c4432))
- enable vercel analytics and observability ([ff421c8](https://github.com/misty-step/chrondle/commit/ff421c8e5f742231e962e79c787f86028edf341d))
- enforce pnpm usage and add CLAUDE.md documentation ([e73b283](https://github.com/misty-step/chrondle/commit/e73b2839c4926a6a6254dd2e8bc8d57ecdc4cbc5))
- enhance animation constants for deliberate pacing ([7ba9725](https://github.com/misty-step/chrondle/commit/7ba972583afe354e3079ba853bf94da9115e1f42))
- enhance BC/AD toggle UI for better mobile UX and prominence ([2bbf85a](https://github.com/misty-step/chrondle/commit/2bbf85a1619735441b78ad0d9d4cb9951a3df748))
- enhance CurrentHintCard animation for deliberate pacing ([4d8b5f0](https://github.com/misty-step/chrondle/commit/4d8b5f001a4e1098e0330e60b20056f0e73d6aeb))
- enhance dark mode visibility with Museum After Hours palette ([94f42e0](https://github.com/misty-step/chrondle/commit/94f42e0d408e8406a619fc27e96ab9ff2a54716e)), closes [#FFA857](https://github.com/misty-step/chrondle/issues/FFA857)
- enhance GuessInput button animation for deliberate feel ([2909332](https://github.com/misty-step/chrondle/commit/29093321eb545411aafd403600e4869b798bebbf))
- enhance hint display with animations and improved UX ([7a8917d](https://github.com/misty-step/chrondle/commit/7a8917d028eb0330b84028cd18ab50af32913494))
- enhance historical context narrative style ([f536590](https://github.com/misty-step/chrondle/commit/f5365905dd64f0cee91d58639c4a49d4517604df))
- enhance mobile UI with comprehensive responsive improvements ([1144cdf](https://github.com/misty-step/chrondle/commit/1144cdf3864c180b8b31fb970c7388ad272edefd))
- enhance notification settings UX and ignore personal notes ([694eac0](https://github.com/misty-step/chrondle/commit/694eac02a2364e733fc1f7c2a1e4e5af0e6e817d))
- enhance notification system with state management and accessibility ([de452ed](https://github.com/misty-step/chrondle/commit/de452ed695e18bb225824e099f43ae709277994d))
- enhance Order game mode with interactive hints and scoring ([a4d64e4](https://github.com/misty-step/chrondle/commit/a4d64e4bc0e880b212bfe470f09032905730eeeb))
- enhance puzzle management system and expand historical coverage ([5360696](https://github.com/misty-step/chrondle/commit/53606967f3a83dbb5a15ef074702d5acb6d29e5b)), closes [hi#quality](https://github.com/hi/issues/quality)
- enhance share functionality to include first puzzle hint ([3dd60ed](https://github.com/misty-step/chrondle/commit/3dd60ed99eeffa720d8215cf89a6c3504c273e5c))
- enhance type safety with TypeScript improvements and runtime validation ([8bf2c8b](https://github.com/misty-step/chrondle/commit/8bf2c8b1862df9ef6231c90a2982946412123d5f))
- expand historical puzzle database through ChronBot curation ([9593f82](https://github.com/misty-step/chrondle/commit/9593f82a4b40e2ad3c27a6a9313b7626a2c72fa6))
- expand puzzle database and improve validation logic ([c8b0877](https://github.com/misty-step/chrondle/commit/c8b0877b302e0cc9d0c31c4ea5a99b00e1d29603))
- expand puzzle database to 100 historically significant years ([70a485b](https://github.com/misty-step/chrondle/commit/70a485b6d069128869484ad14fba8e54af0412a2))
- expand puzzle database with three new historical years ([9867ec6](https://github.com/misty-step/chrondle/commit/9867ec6ca2d423bde715bc04838a0776b6b033e1))
- extend plays schema for ranges ([b343852](https://github.com/misty-step/chrondle/commit/b34385213f681cc601bec50447fa440b3d4def36))
- finish games gallery component ([575905c](https://github.com/misty-step/chrondle/commit/575905c7ee05d1e47346d2f909410d0ea46baee1))
- **frontend:** add anonymous streak storage schema ([a398535](https://github.com/misty-step/chrondle/commit/a39853550762be064dd55eebdecbd90441aaf431))
- implement 150ms submit feedback micro-animation for enhanced engagement ([bb4d51c](https://github.com/misty-step/chrondle/commit/bb4d51ca5d2d244061950bd7942fa9225830a8eb))
- implement accessible touch targets meeting 48dp mobile standards ([64bbc0c](https://github.com/misty-step/chrondle/commit/64bbc0ccfc010b48a58a4cd24bdfbccc82af2397))
- implement AI historical context feature with redesigned UI ([54b40d7](https://github.com/misty-step/chrondle/commit/54b40d7b138dbfd7036c9bfff7baa836b166d11a))
- implement anonymous session persistence and Convex migration ([8247caa](https://github.com/misty-step/chrondle/commit/8247caae6e4cb4ee35cdd9c65adc57151454baa9))
- implement archive feature with browsing and game state support ([d671c14](https://github.com/misty-step/chrondle/commit/d671c14ab358129eb592be701d6214fd88ee49c6))
- implement authenticated Order mode submission with server persistence ([805558c](https://github.com/misty-step/chrondle/commit/805558cf5071888154811c08cc018ff142f81bd8))
- implement BC/AD era conversion utilities and toggle component ([9a83678](https://github.com/misty-step/chrondle/commit/9a83678adbb1a057d19cb6c3c0e8c3ee4abb2c75))
- implement Carmack-style self-explanatory interface ([95fd581](https://github.com/misty-step/chrondle/commit/95fd581ba0c9ab3195367b0d1cacf9ff24d746a4))
- implement Central Time DST scheduling and mobile UI improvements ([16c622b](https://github.com/misty-step/chrondle/commit/16c622b0006947ffa449b1435013df7965902709))
- implement CI stability improvements and fix share UX issues ([0be3716](https://github.com/misty-step/chrondle/commit/0be37160114db9ce39634d52066ee981efd5fe9d))
- implement complete server-side historical context generation ([7325e55](https://github.com/misty-step/chrondle/commit/7325e55243916682ed09db3125bb4ed29148e7ab))
- implement comprehensive favicon and PWA support ([27116a2](https://github.com/misty-step/chrondle/commit/27116a2251b8af85b9d70420ed5d9c347ee96cd0))
- implement comprehensive keyboard and screen reader support ([98f35bf](https://github.com/misty-step/chrondle/commit/98f35bf42ff1b7280f1067827bc17886bcc790c0))
- implement comprehensive pre-commit and pre-push hooks ([bb3ea20](https://github.com/misty-step/chrondle/commit/bb3ea20e2bb2da2ebde038af276f78a5f1369751))
- implement comprehensive state analytics for game monitoring ([d6247c2](https://github.com/misty-step/chrondle/commit/d6247c2be01fbb5f0a1624a9baf97863d9611e72))
- implement comprehensive UX enhancement system ([c3f9632](https://github.com/misty-step/chrondle/commit/c3f96324f3b51ac370f79e56d47828f4b45685ac))
- implement CSS-first session theme system - The Carmack Rewrite ([7f99152](https://github.com/misty-step/chrondle/commit/7f991524360ffdb77bf5cabe6b3fd795d6155638))
- implement deterministic event validation rules ([6845670](https://github.com/misty-step/chrondle/commit/68456708c3fa9d1281ee29044c8227a14d49e501))
- implement dynamic countdown system with Convex integration ([ec17d6c](https://github.com/misty-step/chrondle/commit/ec17d6c9a4b878f095df79bd34b362084d738708))
- implement dynamic TOTAL_PUZZLES with Convex integration ([4ece94e](https://github.com/misty-step/chrondle/commit/4ece94e3289d8b0f9bbd3d6019a562d031bfbf87))
- implement getPuzzleByIndexAsync with Convex integration ([06d62ca](https://github.com/misty-step/chrondle/commit/06d62ca7e2259b1fa8bfe140953bdf0514615378))
- implement interactive progress bar with color-coded segments and hint rewind ([eea8187](https://github.com/misty-step/chrondle/commit/eea8187c538414ab5614e4a37f150fd3f4000635))
- implement JIT user creation for Convex authentication ([07a2e97](https://github.com/misty-step/chrondle/commit/07a2e97584cf7a7059d9e1ad614c33a01a24a042))
- implement loading experience and archive order puzzle UI ([053b165](https://github.com/misty-step/chrondle/commit/053b16544df01cbe89e8ce3a23ad49e1c8106b80))
- implement main game page with React components ([9330e1f](https://github.com/misty-step/chrondle/commit/9330e1f00dd1196899b999172db573a3e0130a58))
- implement mobile authentication fixes and documentation improvements ([5bce352](https://github.com/misty-step/chrondle/commit/5bce3522418b4c1ce716f9bdf68d688fac437adc))
- implement modular card system and redesign game over modal ([30814ff](https://github.com/misty-step/chrondle/commit/30814ff61f79fbf84f8dac7e7df65c3d5b717714))
- implement mutation error adapter and wire to order submission ([41f2b97](https://github.com/misty-step/chrondle/commit/41f2b974c3a069506c3da987cd7f5476aa572268))
- implement Order event spread selection ([3e1ceaa](https://github.com/misty-step/chrondle/commit/3e1ceaa4267dfd8f7a2db79445bca1b3a6a1e988))
- implement production-ready toast notification system ([cff3dad](https://github.com/misty-step/chrondle/commit/cff3dad5b9afeffb2543468d8f0bfe06f34d3603))
- implement professional engineering design system ([052b0da](https://github.com/misty-step/chrondle/commit/052b0da7c4d0e0441beb8705270bcb790c3dfc82))
- implement prominent target year reveal for terminal game state ([4e31450](https://github.com/misty-step/chrondle/commit/4e31450a95cca64d2737d1f3f613a3b55a18f378))
- implement refined archival ledger aesthetic with deep module architecture ([c6c00b0](https://github.com/misty-step/chrondle/commit/c6c00b0e02fc5185aacf41b7c25b4398f5a48810))
- implement responsive header compression for mobile optimization ([fc41d6e](https://github.com/misty-step/chrondle/commit/fc41d6e16204ff96f77a5cb4de726e08067fc406))
- implement server-side historical context generation foundation ([f8d7821](https://github.com/misty-step/chrondle/commit/f8d782139581ec3fd132ccce3c286db31666b820))
- implement service worker integration for background notifications ([f3850d3](https://github.com/misty-step/chrondle/commit/f3850d3f00eda022d175f4b7ddac9012489df1b2))
- implement smooth share button state transitions ([22da889](https://github.com/misty-step/chrondle/commit/22da889a776885e577e1b12b46db098a99e41ede))
- implement sophisticated typography system with professional checkmarks ([58dde51](https://github.com/misty-step/chrondle/commit/58dde519dce451dae468c202af569e2817b73a7d))
- implement specialized error boundary for game state derivation ([253c485](https://github.com/misty-step/chrondle/commit/253c485da3e4fd0b2e3069e23d0802177a34c64b))
- implement unified motion system for navbar buttons ([6eeac07](https://github.com/misty-step/chrondle/commit/6eeac0785be121435e06153785d9d15eff997f44))
- implement unified semantic color system with WCAG AA compliance ([1f1fd31](https://github.com/misty-step/chrondle/commit/1f1fd31891c57c9d37a0d27d8b2e78aee350ee84))
- improve archive UI with puzzle numbering and integrated navigation ([2fca4df](https://github.com/misty-step/chrondle/commit/2fca4df409130f7d697cebbe14478c7c1054bb0d)), closes [#1](https://github.com/misty-step/chrondle/issues/1) [#2](https://github.com/misty-step/chrondle/issues/2)
- improve Bitcoin donation UX and copy ([41b18f2](https://github.com/misty-step/chrondle/commit/41b18f26bdbab6320dbc26970e7437f66b38580e))
- improve Convex client initialization with error handling ([e47af1d](https://github.com/misty-step/chrondle/commit/e47af1d1594e7532acef038e1b87763d3f7fe3ad))
- improve hints display UX with upward growth and mobile optimizations ([ef6b327](https://github.com/misty-step/chrondle/commit/ef6b327efb818a3f6d52c8fc5c2e0bd109ff0792))
- improve historical context generation quality ([12c91cd](https://github.com/misty-step/chrondle/commit/12c91cd18b7ad36a5fd7440280f6f7a0dfac2702))
- improve historical context generation quality ([57911a7](https://github.com/misty-step/chrondle/commit/57911a71f325ae3b9dfe3228a14d1e1dc75aa511))
- improve mobile UX with current hint above input ([f92bbf2](https://github.com/misty-step/chrondle/commit/f92bbf216b1d15d356ec5a0746da938b03e45e97))
- improve Order game mobile DnD and add planning docs ([bfb504c](https://github.com/misty-step/chrondle/commit/bfb504cb53d1e18bf9c2b3fcc41431d8e58fcfeb))
- improve Order puzzle quality with unique years and dynamic difficulty ([b582fae](https://github.com/misty-step/chrondle/commit/b582fae0ae067e66987db53d3cc0b74c4a9376c0))
- improve UI consistency and fix avatar display issues ([29bd0f8](https://github.com/misty-step/chrondle/commit/29bd0f8a6d9a766a757a7fd8d0f1653d217c09dc))
- improve UI layout and hint progress display ([27ac839](https://github.com/misty-step/chrondle/commit/27ac8396451d43fd092de53f2659997cfd1437be))
- improve user input UX and styling ([5547246](https://github.com/misty-step/chrondle/commit/5547246ad255a99f0741e936170ee1544ed796e8))
- integrate BC/AD toggle into year input field ([946de12](https://github.com/misty-step/chrondle/commit/946de1259662dcc74dbb2d265ac4c0ad409d512c))
- integrate Bitcoin donation button into Footer component ([37af807](https://github.com/misty-step/chrondle/commit/37af807046ee33c2456a2bd06277b350376a9276))
- make archive freely accessible with hint-based puzzle cards ([9304c2f](https://github.com/misty-step/chrondle/commit/9304c2f2f9bb1427f51e337d237db415e569e673))
- migrate configuration files to full ESM compatibility ([6279cbc](https://github.com/misty-step/chrondle/commit/6279cbcac4382c511afcfdca58ea1c9b1f4517f9))
- migrate event generation to OpenRouter Responses API ([406d50a](https://github.com/misty-step/chrondle/commit/406d50a89d835a37afd01c91402b830c1b99e032))
- migrate to gist-based coverage badges ([c06328c](https://github.com/misty-step/chrondle/commit/c06328c762d2de4b64336822ff47f355983c14b7))
- migrate to GPT-5 and enforce BC/AD format universally ([e5ac371](https://github.com/misty-step/chrondle/commit/e5ac371fa075c2ea29e5e7d775e40a826124b46e))
- mobile Order Mode redesign with museum placard aesthetic ([0df3e2c](https://github.com/misty-step/chrondle/commit/0df3e2ce82105b84f0d80b2abc9dc91e2042c593))
- **observability:** enable server-side Sentry error tracking ([ad213c6](https://github.com/misty-step/chrondle/commit/ad213c6999dd2b9a23d75a3d3df8d7339d6203bd))
- optimize developer experience with blazing fast quality gates ([3871d8a](https://github.com/misty-step/chrondle/commit/3871d8ad7948296a2f3f0f2bcb8356ecb63861a7))
- overhaul footer and add legal pages ([f38390e](https://github.com/misty-step/chrondle/commit/f38390e9c1b0c62125c16e874fe99555692ed8bd))
- persist generated events and log attempts ([1616404](https://github.com/misty-step/chrondle/commit/16164047c622b8ce0197a43b12015a34511ec073))
- persist Order session state ([c530720](https://github.com/misty-step/chrondle/commit/c5307201d28e9852994e3ccaa403dc0321fa9085))
- Phase 3 - Real-time observability & monitoring ([#64](https://github.com/misty-step/chrondle/issues/64)) ([35ca8c7](https://github.com/misty-step/chrondle/commit/35ca8c7617b344dc38edd2e983a654a11d467a2a)), closes [hi#demand](https://github.com/hi/issues/demand) [hi#demand](https://github.com/hi/issues/demand) [hi#demand](https://github.com/hi/issues/demand) [hi#demand](https://github.com/hi/issues/demand) [hi#demand](https://github.com/hi/issues/demand) [hi#demand](https://github.com/hi/issues/demand) [hi#demand](https://github.com/hi/issues/demand)
- polish order game aesthetic and interactions ([f261b49](https://github.com/misty-step/chrondle/commit/f261b4975d75ebf6d6882b76dd464de748d27096))
- **puzzle:** add diversity-aware hint selection to prevent Augustus-style puzzles ([#143](https://github.com/misty-step/chrondle/issues/143)) ([4bd5349](https://github.com/misty-step/chrondle/commit/4bd534919538333549bc80f512197825e8305f20)), closes [#148](https://github.com/misty-step/chrondle/issues/148)
- **puzzles:** expand and enhance puzzle data ([256d890](https://github.com/misty-step/chrondle/commit/256d8904876e3d8f819ae8c80c47ce78d0442a76))
- **puzzles:** expand and enhance puzzle entries ([e001f93](https://github.com/misty-step/chrondle/commit/e001f93e19a2d474fff0427c949a8a4b291289a6))
- quadratic scoring curve + event detail drawer ([#74](https://github.com/misty-step/chrondle/issues/74)) ([2e248ba](https://github.com/misty-step/chrondle/commit/2e248bab2bfcf75e46a92520caeaf04b4ad871c0))
- RangeInput redesign with archival ledger form aesthetic ([e21799e](https://github.com/misty-step/chrondle/commit/e21799e407f51b87aa1ffd47671fe064542794cd))
- redesign favicon with vintage odometer concept ([27f305a](https://github.com/misty-step/chrondle/commit/27f305a6f4ac0c863e19a775ae2dd0a2faaa0e40))
- redesign GameOverModal with Magic UI components and improved UX ([9df9c7c](https://github.com/misty-step/chrondle/commit/9df9c7cb7021ca3a0ca0bbdc50f74d85cf385f8d))
- redesign GamesGallery with premium animated panel UI ([0970d84](https://github.com/misty-step/chrondle/commit/0970d84a47b9fa92160d95284551021ca91087b3))
- redesign help modal with accurate game mechanics and improved UX ([4e74c40](https://github.com/misty-step/chrondle/commit/4e74c402eaa5289a1ebd6d928b194dbc45b612b5))
- redesign layout - remove how-to-play card, emphasize progress dots ([ae627b7](https://github.com/misty-step/chrondle/commit/ae627b731c2f3cc4d7798f0a299102d3b6b02f23))
- redesign Order completion screen and add cursor-pointer to all clickables ([8ffe0fe](https://github.com/misty-step/chrondle/commit/8ffe0feb8883efe547aa160c6d50408e6ba46282))
- redesign Order game to golf/par scoring system ([#63](https://github.com/misty-step/chrondle/issues/63)) ([20c59de](https://github.com/misty-step/chrondle/commit/20c59de1df8d740b11169bb328d983efa2a8967b))
- redesign streak counter with horizontal badge layout and enhanced progression ([eb856c7](https://github.com/misty-step/chrondle/commit/eb856c76f02fe27e2e45564b3308b3291e2cf4cd))
- redesign UI with single-column progressive layout ([597fb36](https://github.com/misty-step/chrondle/commit/597fb36d6cda103d1deefb78953f778e735cf5eb))
- refactor GuessInput for positive year input with BC/AD toggle ([b64e720](https://github.com/misty-step/chrondle/commit/b64e720213826adc0b0d36a781d0cde65fdf7e06))
- refine Order mode UI with dark mode support and scalable navigation ([8d6f70c](https://github.com/misty-step/chrondle/commit/8d6f70cc1b57c70fc8587f6fa8511035ad777206)), closes [#c9a882](https://github.com/misty-step/chrondle/issues/c9a882) [#d4b896](https://github.com/misty-step/chrondle/issues/d4b896) [#f59e0b](https://github.com/misty-step/chrondle/issues/f59e0b)
- remove anonymous sync functionality ([51ec100](https://github.com/misty-step/chrondle/commit/51ec100346f28386cc91138a82ad01a58fb8edd0))
- remove MCP server configurations and cleanup project ([5e3cf74](https://github.com/misty-step/chrondle/commit/5e3cf74b72e712b8a7ae8b876c5e1c77e0142f7b))
- remove sponsor/bitcoin wallet functionality ([10b51af](https://github.com/misty-step/chrondle/commit/10b51afba21c95e056e6a82e4035294a19de0632))
- remove streak indicator from navbar ([d5a5a31](https://github.com/misty-step/chrondle/commit/d5a5a31a2fdee3bb658b9b913b78ccff72033ae6))
- remove unnecessary UI elements (Review Hints and Sync Indicator) ([c1fdf98](https://github.com/misty-step/chrondle/commit/c1fdf98740b656b239b5974d7b1afe4b8a9bbc0b))
- reorganize project structure for better organization ([8e90220](https://github.com/misty-step/chrondle/commit/8e902201f0e6db7795b95c44d37cdaa2f0b02075))
- replace colored boxes with temperature emojis & update puzzle data ([a2a684a](https://github.com/misty-step/chrondle/commit/a2a684a224b6840d51dbf1a0554193aa4ef81995))
- replace stats modal with color-progressive streak indicator ([cf1f6c4](https://github.com/misty-step/chrondle/commit/cf1f6c44e9d5d4381e2569f50275156c2ba62cc2))
- replace subtle ShinyButton with attention-grabbing PulsatingButton ([3fa93b3](https://github.com/misty-step/chrondle/commit/3fa93b32cd3e5b8978f4a9d79bb08aeee8ce0c8c))
- replace timeline with range visualization ([ac312c7](https://github.com/misty-step/chrondle/commit/ac312c7e56e60072d4895e162bae5d1318d1d145))
- **share:** implement visual emoji grid share format ([6ada80c](https://github.com/misty-step/chrondle/commit/6ada80c34d986365910e3c6b82dce4ca4fbeb593)), closes [#93](https://github.com/misty-step/chrondle/issues/93) [#93](https://github.com/misty-step/chrondle/issues/93)
- Stripe subscription paywall for archive access ([#141](https://github.com/misty-step/chrondle/issues/141)) ([fd4c302](https://github.com/misty-step/chrondle/commit/fd4c302fca275f6224345cd3769172d3f033ce81)), closes [#131](https://github.com/misty-step/chrondle/issues/131) [#131](https://github.com/misty-step/chrondle/issues/131) [#131](https://github.com/misty-step/chrondle/issues/131) [#131](https://github.com/misty-step/chrondle/issues/131) [#131](https://github.com/misty-step/chrondle/issues/131) [#131](https://github.com/misty-step/chrondle/issues/131) [hi#severity](https://github.com/hi/issues/severity)
- **stripe:** robust subscription infrastructure with Ousterhout principles ([#160](https://github.com/misty-step/chrondle/issues/160)) ([4341de2](https://github.com/misty-step/chrondle/commit/4341de2009685acc95e7bf1404df98aed2b12fc7))
- switch to OpenRouter Responses API endpoint ([6a2403a](https://github.com/misty-step/chrondle/commit/6a2403a66d8f717b51c4532b8faedc1412d0e581))
- transform settings modal to dedicated notification controls ([4527486](https://github.com/misty-step/chrondle/commit/4527486936a0bf718e545eebc5ff56825d034e97))
- trigger preview deployment rebuild with environment variables ([070a121](https://github.com/misty-step/chrondle/commit/070a121454cae75997259c0eebb7a0a02a588bef))
- **ui:** redesign chrondle classic game interface ([057e0a0](https://github.com/misty-step/chrondle/commit/057e0a0329e3f86c5a4ce476498e5534916e2283))
- **ui:** redesign landing page with mobile-first layout ([#164](https://github.com/misty-step/chrondle/issues/164)) ([8013cc0](https://github.com/misty-step/chrondle/commit/8013cc0dfef8b40b7631a74fc68131da47fa1127))
- **ui:** redesign scoring display and improve mobile layout ([3f8dbf2](https://github.com/misty-step/chrondle/commit/3f8dbf220034ba7d1ee39813bbeb7cb51a15e3e3))
- **ui:** refine proximity card design with subtle hierarchy ([c334939](https://github.com/misty-step/chrondle/commit/c3349391ba49eb8fc50d353fc5a06f4dbb892899))
- **ui:** simplify scoring display and minimize hint UI ([e949c72](https://github.com/misty-step/chrondle/commit/e949c723c543a003f56ecf231454cbc1839907da))
- **ui:** world-class design polish with animated scoring ([872d163](https://github.com/misty-step/chrondle/commit/872d163f108a5b70b05d590a52aee5ee434a3a8d))
- update response parsing for Responses API format ([aa65f2c](https://github.com/misty-step/chrondle/commit/aa65f2cd35bae4cea3bc7d5ee218b7758fd00784))
- wire Order share flow ([8fb4cc4](https://github.com/misty-step/chrondle/commit/8fb4cc498b56561ade14e762faf2659d3f7da9dc))

### Performance Improvements

- **ci:** add caching for Convex generated files ([d7e882c](https://github.com/misty-step/chrondle/commit/d7e882cb8a26553435265991a4e90cc7a51d116e))
- implement React 19 performance optimizations ([6142ea6](https://github.com/misty-step/chrondle/commit/6142ea682b351ca1603b0917a45ade4a6b11c8df))
- optimize mergeGuesses from O(n²) to O(n) linear complexity ([3bf84a7](https://github.com/misty-step/chrondle/commit/3bf84a749c10c04c09a395ba822706d8bab5ac37))
- optimize pre-commit hooks for maximum speed ([4721812](https://github.com/misty-step/chrondle/commit/4721812c862be0b1dcd0b57b514d1e1f59319def))

### Reverts

- remove all Lighthouse CI fixes from BC/AD input PR ([8621eb3](https://github.com/misty-step/chrondle/commit/8621eb3df6baa2cca23bd7e0aef8448a82f8636e))

### BREAKING CHANGES

- Notification feature completely removed
  All notification functionality has been removed to simplify
  the codebase and eliminate Service Worker complexity.
- Puzzles now generate at UTC midnight instead of Central Time

Co-Authored-By: Claude <noreply@anthropic.com>

- Page component is now async server component

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

- puzzles.json removal will require import updates (next task)

Co-Authored-By: Claude <noreply@anthropic.com>

- - Default `pnpm test` now exits after completion (was watch mode)

* Use `pnpm test:watch` for watch mode

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

- Theme persistence removed in favor of session-only overrides

Major simplification of theme system following Carmack principles:

- CSS handles system theme detection via media queries
- JavaScript only manages temporary session overrides
- No localStorage persistence - always starts with system theme
- Simple 2-state toggle instead of confusing 3-state system

Code reduction achieved:

- Deleted 5 theme-related files (400+ lines)
- Replaced with 2 simple files (220 lines total)
- 90% code reduction with zero functionality loss
- Bundle size maintained at 261 KB

User experience improvements:

- Page always starts with system theme (predictable)
- Click toggle to override for current session only
- Refresh page returns to system theme
- Clear tooltips show current state
- No confusing 3-state behavior

What Carmack taught us:

- CSS was already doing the heavy lifting
- Session-only overrides are simpler and more predictable
- 2-state toggle is more intuitive than 3-state complexity
- Less code = better performance and maintainability

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

#### Deprecated Functions in `src/lib/gameState.ts`

- **`getDailyYear(debugYear?, isDebugMode?): number`**
  - **Removed:** This function was a placeholder that always returned `2000`
  - **Reason:** Daily puzzle selection is now handled by Convex backend
  - **Migration:** Use the `useChrondle()` hook which calls the Convex `getDailyPuzzle` query
  - **Example:**

    ```typescript
    // Before (deprecated)
    const year = getDailyYear();

    // After (recommended)
    const { gameState } = useChrondle();
    const year = gameState.status === "ready" ? gameState.puzzle.targetYear : null;
    ```

- **`initializePuzzle(debugYear?, isDebugMode?): Puzzle`**
  - **Removed:** This function initialized puzzles from static database
  - **Reason:** Puzzle loading is now handled by Convex with dynamic puzzle generation
  - **Migration:** Use the `useChrondle()` hook which automatically loads the daily puzzle
  - **Example:**

    ```typescript
    // Before (deprecated)
    const puzzle = initializePuzzle();

    // After (recommended)
    const { gameState } = useChrondle();
    if (gameState.status === "ready") {
      const puzzle = gameState.puzzle;
    }
    ```

### Changed

#### Import Changes

- Removed `getPuzzleForYear` import from `src/lib/gameState.ts` as it was only used by the deprecated `initializePuzzle()` function

## Notes

- All puzzle-related functionality should now use the Convex backend through the `useChrondle()` hook
- Static puzzle database functionality has been replaced with dynamic Convex queries
- For archive puzzles, use `useChrondle(puzzleNumber)` with the specific puzzle number
