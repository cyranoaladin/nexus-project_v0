#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const rootArg = process.argv.indexOf('--root');
const customRoot = rootArg >= 0 ? resolve(process.argv[rootArg + 1] ?? '') : null;
const staged = process.argv.includes('--staged');
const root = customRoot ?? process.cwd();

if (staged && customRoot) {
  throw new Error('--staged and --root cannot be combined');
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() ? [absolute] : [];
  });
}

function trackedFiles() {
  if (customRoot) {
    return walk(root).map((absolute) => ({
      absolute,
      path: relative(root, absolute).replaceAll('\\', '/'),
    }));
  }
  const gitArguments = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=AM', '-z']
    : ['ls-files', '-z'];
  return execFileSync('git', gitArguments, { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ absolute: resolve(root, path), path }));
}

const ignored = [
  /^__tests__\/scripts\/fixtures\/versioned-credentials\//,
  /^__tests__\/scripts\/fixtures\/secret-scan\//,
  /^scripts\/security\/check-versioned-credentials\.mjs$/,
];

const executionSurface = /^(?:app\/|auth\.ts$|components\/|lib\/|middleware\.ts$|prisma\/|scripts\/(?!testing\/)|e2e\/real\/|ops\/)/;
const exactPlaceholders = new Set([
  'change-me',
  'changeme',
  'example',
  'local-only',
  'pass',
  'password',
  'postgres',
  'test',
]);
// Exact SHA-256(path + NUL + variable + NUL + value) entries for reviewed,
// synthetic test/example assignments. A value or path change invalidates the
// exception; potential secrets never need to be copied into this scanner.
const allowedAssignmentDigests = new Set([
  // scripts/demo-utica-env-guard.sh — local-only placeholder secrets for the
  // UTICA demo standalone process, only ever exported after
  // demo_utica_refuse_inherited_env() has proven the calling shell holds no
  // production credential for these names (hotfix P1 review, PR #174).
  '76cccd14cbfb8fabcb01d588db461d4007f6b396bad06789b216dfa49b71ad23',
  'b1daf09824823d6644244873c1a7f5cd8bffc80412fa20d0b0b2e6ca51472d76',
  '7510da16649c2253157785f41da762ce10268b4ee396c472ef60112c1b2dbe27',
  '12429c4d19aac8a12ce012c6ba3ca458c38122c604fb2e08ab1c15c19d7cef80',
  '15144685ced4ed7d242aafd18fd9111d8fe0644e0d7995f02f8a0be42aa13ddd',
  '1edabaca9cf4c872c2341645a12addc50c9623b52590685d836a3448357e043a',
  '328273a1e20df604dc3aeca263030dfe50d94e57f960ca5c7ec263e936ca9c4f',
  '42d3db54db121008752bb4be29d6fe1274d41d37d2708029c48c89351b578f9f',
  '8fa1ae77862cd8d3a2e0e9e911e919e9595cfc1081daaf2d65c5401a8d6bf04c',
  'b2bca62c3c34d3bef76caec864652284a68734a3f4c44f8772fa9fc742ce9946',
  'b561f9c3cbd8d69457e64a57150f3ec1b80e99a2b005ffae43c9cad6247c6bca',
  'bd8d6292e3d2e1d52e61478e1a1bf1c74c5884870347b0c99b3f2aa9ab554a74',
  'bec08a7f37640b16020c7564e6b904942d99254444f6348c47f56305765a53e1',
  'dcc38126696fd4fc3a711e37bc9acde99ee84ab104b38f865d843a8d05a75a7a',
  'e08d88657e06551c1b788593e18737d5343b9446be7583951768ab67c3fd263d',
  'ef6195da9968c431f7bdc7d23b3fac91f528999fd22cdf9a5f3e5853f696f9d2',
  'f31e67ac00ece811368880b648320a7446a5b9bda094ecb1b7234339a397d5e7',
  'f426a0c91a2980009befba86e94d31a19f2eb9e3b963633851866e2bcbaeae32',
  '074d00c5df5206a60d043fad1d00188fd04062441a6728164ba0a57f1cc4f31c',
  '0d8e34a84505fc85b461399fa3514bef276d2fca145b1d021a6487f89261398b',
  '0e016fa71f920082ca6c4b62263dfcedb81164c77b70894eb0a93ac2b40133e3',
  '0fd81ada4758f4be31a143792389ea3f2b8a263192a888b8a20d529614ea66e4',
  '030ce4d28e337a2ffeb313761d298b2719e0404ee27ddbc86f8e059725f84b36',
  '055c767b79aa75390c5ceb5c218e4eaef31ef9fcd0bd76bc2cf44d3234316152',
  '079a7d0a95ccdf675bebc2fa8c0a3de5a5ed05cf7749f036aebbf2b3ba180202',
  '0804b9e1a31498685da9a21300763493d88eaadd8dcc3a13345d209672b4b382',
  '099f989dead226debd6d5a1dc19b4f99d41459d6a1a7ddd0d75be09b83000912',
  '0eb00b567218f7ed544f363f79c3129cc1a421e4dd924b8db6a2022e25ae2e90',
  '0f5c555dda24ba78b88116ff6233c268ae277fb3d1618845f80a0124ed157749',
  '11a2706d7e011dbb71bdb8d3334f314f5c589b5e43fffff40c4ac7711bc1ebb8',
  '1457833f2b9161c81e4c77d0a049f374619d740ea0fdc9ecf70e0577acdfcf70',
  '159eb755c343c39613848e6a6ea803694ebd9a05caf8be278ff143661e55ce2b',
  '156ddcbda73072bddb3ada58a4ea77b27f6cbc2f9f0e67300fbb4ebc35820a4e',
  '17310c96c01a518ef99cfc7fcf09de1aca617fe890751e9ba2ee3eb9ee91f00f',
  '19f21e25915d960a1013a054686ddbe4f73dbddf8aee5fc693d6c6e3d412506c',
  '1de97899471d1e9add86455ccc1a3887bb7a865ecc5ebfa8cf21e8c95bc3ce85',
  '1ea429e93a3a1608a560573c565310fe7de38dcdf5f7b20b4002c0111f47d01a',
  '1dc70a4d49686536883ac94a4d1f73ef48f0a5e410fb2d583ec6c2c348521791',
  '1f182351d7a4d57559f3bbb436489ac17f0968d84883051aed7f94a6969323b1',
  '1fdde5cb9bd2813cd32cbe28dcd8281dd9a5d999668ad0de95ad4c67880d4059',
  '2284e3c5d4c685c6ca4aba938c94ce171367aca4f178e938243cc8faaa0df08b',
  '26133b7cab86bd3a7092dc25559f848fc660ecc7bcd6aa2139bb2c6c9fa0fa00',
  '2e4a19ee57a20caeee56a527c6ddc1bf82fc3a14e99b75ab3b2b175513321343',
  '2e57c95e650247d611e8b22f9c12ffde90f32f32526211851000caf0393814f4',
  '293b85d2291e179508e8ec500f4c2c4ccbf71161a78ecd0a99583d672c6f913a',
  '2ed456b670bc918646267faaf4d7e69d8c25c812972a4b428dc59a2fc6c71da5',
  '374243c14ccdea25445d237b9c032c6baea6baa31f1fdb5cc719ff479360b907',
  '3d4e456e6b8b2f65888b539036dd9a01cb546830e00d62837c2a6bbc392e6612',
  '3e86a581946ea8b1ef9c2de4ed81645705e9931f3dc303464bdfd60a54c21016',
  '42d1a3bf883803c175c148f21e5ff0be290fb95a477b141f345d228a8b4f4ae6',
  '47becd925862fbf5cfdbccb219d0b0d301baa6c5ffd3c73c3398fc2cef285a3a',
  '4c9bf7cdaea3ce52d1f91cf70d0322d927057050588e4a106781be4fe67dc0d6',
  '548fe9710d2f509227cf2236ac69d33ab57d789641b9410da704270b70069c1d',
  '5416bafd0db8ad6b2ae75cf4ba0bc8a3783559d43a4ed71a0ce06557153b0f2c',
  '54e01457bf294a2fda0a40dd0353b607d1e42f247adf0c77851cfa360bfd19a7',
  '567bebf113aed7d56b5024ce453136089b541768f5de385e6f4ad081d52d168f',
  '5a59fbeff6fb9251ec647ddac84fd3e2a897dbe511acdb43af305cfd85d1a730',
  '5c7469694a5c5043ae882d19f21834af48d8257324891041b4fc8393ba03016b',
  '5cf251ba2578c957cb5dfa7ea25309f9cb929aac10a67990ef8037c49c10987c',
  '5dca2a9541f6bfe8159bcf1aed09935e663c403856583b44031d47eb0c7eac94',
  '5f9ad1b8c29d0308719a89e3f62de80a349840eeab4dfc2de5ccdcad7e583170',
  '605dfe1ee6bb6be3b9a66299062ec8895abf015b5945e1a990f36f076788b51b',
  '610d9b89b5a70a2978c2dcd22b90993ba0105779b65f9b299bf7b0eb7fad0553',
  '633a4fcda0853d02cb7c5d1448e89d3a8ea75dafa0bc7e99d77c03659f4027bb',
  '662647b3dca81da257d9148e0ddaa966ebb683d0b2487a16dbb6aface143e937',
  '67850c12f8eff13e63df3d56f1c80020a0dfd3b687eca7f3215f9f865499ae74',
  '719d1af5d4bdef38d650514d933c60208f5cbfe9e81dd1bf60cb143e206d39c7',
  '72945038683f661af78fb4fb0d9f43ef62bfa8f6ed0259a7ad73a64f97eddcc6',
  '72cc6b22d0599f4ed66a939abdd3d8fba6bb57cfebbaff888145597afb5d7dac',
  '743dd9e5fa338c374830fd426351b9791a357cac250a81ca682762a767e9ea35',
  '7dc28d3203891dbf91abade5820aeae2dcd44154fed20739ec3ed1846413d0f9',
  '7f049e6bc532d80a2e7101a10b02858691fc74f3cf88f9a0244bb74f95303d0b',
  '81fc1b6f78aa685b4aaf37a505326c7127de3d0bb2ac5b8524f3c12becaa51db',
  '861761ba79468fc81198c10f850a2771836baf7e9643823ac552ea84aa50b0e7',
  '8a9d908319bbb9555f7e84b03d782500b33a1943dd32cc1e19f49e28bfdd4087',
  '8ba784f05b9351a8d19313a51c06c85553926116d3f1991fee2c785c950e4478',
  '931074e38f12e8f3398d432d06fc8f8d8e0f23773f2845a7916674b56e400f0b',
  '9430f04dc49b12617c87ffab83cb9c21e947d492fb9a295ba0cf110e5cfddf43',
  '94773441d4ef95e1ef35a45c40a130ef53fa09ec7fbd40863b85f130dfb05833',
  '94e2b9722263805cba041bc556186c7968bcf90363c5344852aa66562f5b5e70',
  '9534d9f715be86ad6b031706a682329c9ee7e48b99af1e8be66382eab51212ba',
  '970141ddb9e747a4674040e9a5a30d12f0536ca12e2b673d58d88909b0e9dc2c',
  '9e6e2f00137429cdc0a219f1613a266e5c736e2e40d2d56699046d2b7956d916',
  '99e9c7fb9ff15a526f41f75d9ec687501030bab79be3fb672e0ed193b84c7354',
  'aac3702f2a42884a0302d37359d01fee411e555c09bed5e64839d97101b15a7e',
  'b76b45888520d6b94f926e811ce07a3070e961f5bced8e28dcff48bb8f4b1510',
  'b7f0136968ab039718a67975473c8fcfc1ca31b015e0ff1c56000ed6530b220d',
  'ba307ad9fb8a9ea09ac43fc4d7382651bcd1727131baaf8a2a5a14111254a970',
  'bced18b7be0bc9cb675e9c7aedb39a14d0ad19581c3fa65fefb66403b6761544',
  'bd730c20e27e15176f6a494bdf04f3c99ad0cf0feab6e0eb08ae473674b9d2ac',
  'be2b46474cd30c56aeddd94f2362c6b7e77a81e4c58e60903339afcfacca95ad',
  'c09e0959125cd53ab463b213da497516fff4112ccb262fd8a5228f8b59d5501a',
  'c6b6d251b18192a515109cb34f822ad44b032c80b7a3aa3ddd4f7947cabe1f34',
  'c6e43db7bf52434bf2c050752e8b126c2a7125cdcff1a51009b8dc42ab592056',
  'c8a906ff08642670af61c9da26c639f4e3adec9f2de0593ad513606230dd8ff8',
  'cb60b9e33be401c951dd3977542f9c9138e82631120d69a46f3314ff561b9c3c',
  'd42da15f729a7e1fb248a7a3f883b00b9abc7ed43a20abec7fa69a2b3d3bc96b',
  'd592ce16b52f6be18c11d001205f283b44d7b88fbd65aa8e78b7f2202266ec53',
  'de5f1bde49ad0852aff0e776a4ab2f86726b17c288b33085bd2caed58596af41',
  'e0ee2e07ec468c2b6a87b6f5dac9d6baec8947bc23e4934d1468c31d527d6cfb',
  'e761a8afb0785a6fd122034c55bbbf535c90dc0e746520c5153e4be2e8338553',
  'f32f2fb82d89d9f31c5ff2c01c9b6a36de6218b11a81b49bebe40309cf62ae9c',
  'f9b3a220c46d6e0d415f9dde70a99a7f8155ce990e446c6e75a1db9c732d04a9',
  'f9f6ccee780fd9a4b2e3ac2bf1d32f1b9bb473056729f9824e9a3323a5067a44',
  'fa7258f9fdf8c712b67d86c302e037303c531af84ccc9143c76575355c0877bd',
  'fa78148e79ac2a66f8fa4d54391dd783554bbe31bc57540fd06f6b596a79deab',
]);
const allowedDatabaseDigests = new Set([
  '48bc2617c350f2a1caae494ea38af3a2c258d1b1479334ff6b804030c0db1d9e',
  '5a13e858d4f6e224c31cfb093a14c09e675ff7fd4902207d699675a5f390622b',
  '8074d859e15119c0ed754cdfaea1198a93858a8556617fa8eb394e569cd05612',
  '8f2f39ae0df3b269fc36fb0a64d8be9ffa07717f0a154c7b37279693dc5a8bf8',
  '18c0ec33dd2501a1b4116cf3fceedd162bfa7021994114fffdc6810ba9f82ae3',
  '19b1aec892b2e9605342b9d77337a02a97c9894a8dff43e64f8a21e810daee29',
  '1a5b2b2a09d59888ff85e6ea77b86fc2667580540e183e5f37601f97f3e572f4',
  '1d1a65d4852e53945cd5ca79c609a8ac9d967d6b49219e0551151c888a9f58fd',
  '1f24e57bfc6386dc4dc9785e40848fedd9e7a082dc049cb5ed6c18b1b455ebdb',
  '1f6c2dc191d0cb1dc5416151d338d5ab320d2f791a0bc544c1e6138aa9c8eff9',
  '211cda317ff93ec624cca15fbb0a709462be141ab9c6a9752eff5a1786cb5b1a',
  '2a52910b6fdd4e22aab57c5554942387b94d136247f95b1b896e399db41887ee',
  '2f28394093e8c278b5378a45fad3e54869a2161e1753894166f1c3e37438e681',
  '2f4aedd3eeb51eb9300c9ef592d6fc9c54d514e133b084b1bdbfbd1395901e6d',
  '317f025ff549e8920e7a69fa18e1d15e1eb77fedda95f60245128d4c1e4e5c08',
  '40588724ce3585963387422a5a8aab1820bd3e41b8721a860747a0c4ed9d2b5f',
  '4660f4caa9aa1f1a37a5abf210a748b0d4bd6beaafde826df4d1b13117f06f9f',
  '4b7a165b59e3d2917a2154ada77107da8c05d36d42575430b7853e978c3078a3',
  '5a4c099a5a9e45a2fc1730e402b6eec9921dbbcc1e4b1571fce3c0250b965b29',
  '5ae764468d87617d1337221a65c4242b92d06c614d854da75ce8910d8907d2e3',
  '5bb0ae908b5cbfeb4653d93fd5ca2a35bbf42f3059eb37f3292ae4471ae760f1',
  '5d6ddba5c520830293d9484d4453b6b7c1d353e43671c8531a91eeb734c78de5',
  '5d7822b693dcb876f36be9a25f2b76472782e2008f82d1dbf83f461fb8be2add',
  '5e47ead54e967932bc142678945402bde33540d7a257fa69b5fb4af1524e21d8',
  '5ec906057b10e0ef47876adb6b09a75341b29d1e4a84a9570e01fa0ed79fabf7',
  '60d2b42d8111078569453543d7e02cdfa4e0102434447086919c8874adf4c8ee',
  '69a41d9131bf7a2d136b4a3e5315642c01e55e13118c1fdf74fd1e2ef3e24441',
  '6e14a88cee9d1caf4752785c9254d9e069d3183c9bc229a1b4a5a0aeefc9ae09',
  '748e47a18b2f719d89d953a789f017f4604750b4b6cdeb67d832729cdd669ce1',
  '74ccbb8977627eb3352c64f64fe4f717d34250a4bbdaed8eac0261a43fe30298',
  '854c12ece2096d21485f250d35460982ed01d406fbbcf63689ba3fcd0ba77cfe',
  '87079d689a3a491ef1839d3ad31191c2043165b9921bff45ce2f3f9157b7bd17',
  '87956806215527a4988236f8678f938faf25328447da74bc9459e94b8078b2b0',
  '8e86fcc94465bb1540273bec27e751d7cbc90980fd0a6b277676f9d50df35149',
  '977388c80c7371fafe353d158905e13cff3bce62ccd62cac280e46bed6962135',
  '991ef3633e3282221a88332db2c1a1072e963e3995d63d01d8e2799a166fca4b',
  '9d95b6931bbe7571cc1a1d8597d37c897c6ef6ac33143bc414a5c6fa017e5982',
  'a4b47398b041a0df5485d50a7ce90fc8506597ef7253550a541b5315b6d55992',
  'b6acfe073ee2ce14482961f21c1c8f168196e3951a1b2c984f1b022b187418be',
  'bff76cfe39712b8f29823a2b107e0880d52577c13792a61f85489f0387eb5f84',
  'c051178e8308f2521b4f57323bfe9faf0e62687d904f98769450ae6a6d365d95',
  'c175203468e720fb8d4aafc6e3b302e3ad9b7de7a195b3c2480e0d1adcd05595',
  'c589f13a142695560b171f6e46e06093054b892005cac698fa48b6d8a4d63bd9',
  'c65b20253295531bb4a7d62bb4c24b274fedec5b3ed15ec42f742451e927f454',
  'cffe3660cc5e33f1345a9e9202ed8474a99626fb179ef108d138ccbe47392700',
  'd5ac630b3d7a4081b65bb146304315addd8793770eefe390a61947e615619b27',
  'd5f9d642fc1d5ceb8d205a1a09aa22fab445996bf922ace0998751371380aa55',
  'de57979ada271edcf43333fa09ba0e3cbc25287e41a1f17a9da373f1ed5b3012',
  'df49dbfaef9ed53f77a315966709ce92680a3b8b4f6f0b30d65188b9e7489677',
  'e0da4d43b49cce95d739cdb052d9d034a7eb40777740c9a911b86ca925cdaf7d',
  'e15df16d6eb4eed5da549435cd79999b9a60467c3166068361c9cbf30786784b',
  'e1ff32bcd8a33233cd8eb8804077d3fc9fffbd5b0b13423f48d52d21d72a531b',
  'e88292b89855cf0e43b53adb2b2225405a2ead8d48e639d33889891b363f27ec',
  'ebd5bf04ba874bbfd9d55f70340759522833389d3db7814e0d014da121580dce',
  'f390e55b2cf5d6b74b1441c5e988b832b718ca92a0775431d8996c12ef272710',
  'f50b73ec02e4120978b597c32de6d31cf5634c6bed8b7aa8524238ce63afeea5',
  'f7f7f52ffe6d2f5f8472e2b17938f945de600b1458dfd3fa1abed09966937472',
  'fb95cb729fc0d91e0df62608ba38dfa4e9b96bd6ad0bf2edca0322b0f6264365',
]);
const allowedPasswordDigests = new Set([
  '05122bcb986edb5722b7040ef4d3e9758dd390f6f267b95d9dbca81e42ebbdd5',
  '07973e5df10522f4bce34684414618f35fb517c0eafb1d9c5a486b60715e4f19',
  '1ef34c757a46bf60198ea7275efa0a77411b239d8de3b3a614d06bc172639d7d',
  '26bdf970ce669485dfa3978338db71e76cf97d60ed5e9c154685e0a3a6d35331',
  '35e5ba710bd7f7e44b8853f148794bf0fa70861e6c0dcca92c22b13719aae190',
  '646bad1d9db4937f27633f3c914d5abe9bbaabb3e6a844adc16f8e14a2cb3a77',
  '676cbe719361fe5508001b874f878fad08bac3061947a05647a24592c574c9f5',
  '789186f2487d7b0e19bb8458129371fc2d0af99cac369d33bfbe2c292531850e',
  '936bc70b326e015dc8b8fbd4027c6d363e474adae93933c276c0abd8028c8432',
  '99e52c0bd9b09fb35b9ac2a9f0c754ad614eb2b197aed3b6abc18c57c2a1da0c',
  '9c60f1d364deaa8ef7b53904f348bc4b0de98f2260e60e7480b98e0fc9d84901',
  '9fe7af5789211d0a61543642126deec836aab722d7fd457ce84f6591db715663',
  'a46269941f799a1295a310802d1f31b6c3238c92838da5a6cdfdaf30878a2326',
  'a7d841c1efc1901d67413d638c96850e3389abb02a537a678c3204a7b896bca6',
  'ba3a160518d3496c699d5b1d5f4bddf2501a62c8fc4d8059e4fd7dd898aefb33',
  'be13876ed42af32dc6063d204fa064147af64b023bec7dd582de2b973a09ce87',
  'eab856eef25f604ec1b58650ca611e244c2a2088b85ad786cbbbb665c7390b4b',
]);

function isPlaceholder(value) {
  const normalized = value.trim().replace(/^['"`]|['"`,;]$/g, '').toLowerCase();
  if ((normalized.startsWith('${') && normalized.endsWith('}')) || normalized.startsWith('process.env.')) {
    return true;
  }
  return exactPlaceholders.has(normalized)
    || /^x{8,}$/i.test(normalized)
    || /^(?:<|\[redacted|\$\{|votre_|change_)/i.test(normalized);
}

function isRuntimeExpression(value) {
  const normalized = value.trim().replace(/[;,]$/, '');
  return /^(?:generateRuntimePassword\(\)|(?:crypto\.)?randomBytes\([^\n]+\)(?:\.toString\([^\n]+\))?|[A-Za-z0-9_.-]*\$\{[A-Za-z_][A-Za-z0-9_]*\}[A-Za-z0-9_.-]*)$/.test(normalized);
}

function isAllowedAssignment(path, name, value) {
  if (
    path === 'scripts/auth/process-pending-parent-accounts.ts'
    && name === 'INVALIDATE_EXPIRED_TOKEN'
    && value === 'INVALIDATE_EXPIRED_PARENT_TOKEN'
  ) {
    return true;
  }
  const digest = createHash('sha256').update(`${path}\0${name}\0${value}`).digest('hex');
  return allowedAssignmentDigests.has(digest);
}

function isAllowedDatabaseUrl(path, value) {
  const digest = createHash('sha256').update(`${path}\0${value}`).digest('hex');
  return allowedDatabaseDigests.has(digest);
}

function entropy(value) {
  const frequencies = new Map();
  for (const character of value) {
    frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
  }
  let result = 0;
  for (const count of frequencies.values()) {
    const probability = count / value.length;
    result -= probability * Math.log2(probability);
  }
  return result;
}

function isAllowedPassword(path, fullMatch) {
  const digest = createHash('sha256').update(`${path}\0${fullMatch}`).digest('hex');
  return allowedPasswordDigests.has(digest);
}

const rules = [
  {
    code: 'KNOWN_SEED_CREDENTIAL',
    pattern: /\b(?:adm(?:in)(?:1)(?:2)(?:3)|pass(?:word)(?:1)(?:2)(?:3)|Nexus(?:Test)(?:2)(?:0)(?:2)(?:6)!?)\b/gi,
    applies: () => true,
  },
  {
    code: 'SIGNED_BILAN_TOKEN',
    pattern: /(?:https?:\/\/[^\s'"`]+)?\/bilan\/consultation\/[a-z0-9]{16,}\.[A-Za-z0-9_-]{32,}/g,
    applies: () => true,
  },
  {
    code: 'SIGNED_BILAN_TOKEN',
    pattern: /\b(?:cm[a-z0-9]{20,}|[a-z0-9]{24,})\.[A-Za-z0-9_-]{32,}\b/g,
    applies: () => true,
  },
  {
    code: 'CREDENTIALED_DATABASE_URL',
    pattern: /postgres(?:ql)?:\/\/[^\s:/]+:([^\s@/]+)@[^\s/]+\/[A-Za-z0-9_-]+/gi,
    applies: () => true,
    isFinding: (match, path) => !/^\$\{|^<|^\[REDACTED/i.test(match[1])
      && !isAllowedDatabaseUrl(path, match[0]),
  },
  {
    code: 'PASSWORD_LITERAL',
    pattern: /(?:password|passphrase|hashedPassword)\s*[:=]\s*(['"`])([^'"`\n]{6,})\1/gi,
    applies: () => true,
    isFinding: (match, path) => !isPlaceholder(match[2])
      && (
        executionSurface.test(path)
        || (match[2].length >= 20 && entropy(match[2]) >= 3.5 && !isAllowedPassword(path, match[0]))
      ),
  },
  {
    code: 'PASSWORD_LITERAL',
    pattern: /bcrypt(?:js)?\.hash(?:Sync)?\(\s*(['"`])([^'"`\n]{6,})\1|\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/gi,
    applies: () => true,
    isFinding: (match, path) => match[0].startsWith('$2')
      || (
        typeof match[2] === 'string'
        && !isPlaceholder(match[2])
        && (executionSurface.test(path) || !isAllowedPassword(path, match[0]))
      ),
  },
  {
    code: 'PASSWORD_LITERAL',
    pattern: /input-password[\s\S]{0,120}?\.fill\(\s*(['"`])([^'"`\n]{6,})\1\s*\)/g,
    applies: () => true,
    isFinding: (match, path) => /^e2e\/real\//.test(path)
      || (
        !isPlaceholder(match[2])
        && match[2].length >= 20
        && entropy(match[2]) >= 3.5
        && !isAllowedPassword(path, match[0])
      ),
  },
  {
    code: 'SERVICE_SECRET_LITERAL',
    pattern: /^(?!\s*[#'"`])\s*(?:(?:const|let|var)\s+|export\s+)?(?:process\.env\.)?((?:[A-Z][A-Z0-9_]*(?:PASSWORD|PASSPHRASE|SECRET|TOKEN|API_KEY|WEBHOOK_SECRET|ENCRYPTION_KEY))|PASSWORD|PASSPHRASE|SECRET|TOKEN|API_KEY|WEBHOOK_SECRET|ENCRYPTION_KEY|SMTP_PASS)\s*[=:]\s*[`'"| ]*([^\\\s`'"|]{8,})/gm,
    applies: () => true,
    isFinding: (match, path) => !isPlaceholder(match[2])
      && !isRuntimeExpression(match[2])
      && !isAllowedAssignment(path, match[1], match[2]),
  },
  {
    code: 'SERVICE_SECRET_LITERAL',
    pattern: /^\s*(?:(?:const|let|var)\s+|export\s+)?(['"]?)((?:[A-Za-z][A-Za-z0-9_]*(?:Password|Passphrase|Secret|Token|ApiKey|APIKey|WebhookSecret|EncryptionKey))|password|passphrase|secret|token|apiKey|APIKey|webhookSecret|encryptionKey|smtpPass)\1\s*[=:]\s*(['"`])([^'"`\n]{8,})\3/gm,
    applies: () => true,
    isFinding: (match, path) => !isPlaceholder(match[4])
      && !isAllowedAssignment(path, match[2], match[4])
      && (executionSurface.test(path) || (entropy(match[4]) >= 3.5)),
  },
];

const findings = [];
for (const { absolute, path } of trackedFiles()) {
  if (!staged) {
    try {
      if (!statSync(absolute).isFile()) continue;
    } catch {
      continue;
    }
  }
  if (!customRoot && ignored.some((pattern) => pattern.test(path))) continue;

  let source;
  try {
    source = staged
      ? execFileSync('git', ['show', `:${path}`], { cwd: root, encoding: 'utf8' })
      : readFileSync(absolute, 'utf8');
  } catch {
    continue;
  }

  for (const rule of rules) {
    if (!rule.applies(path)) continue;
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      if (rule.isFinding && !rule.isFinding(match, path)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      findings.push({ code: rule.code, path, line });
    }
  }
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.code} ${finding.path}:${finding.line}`);
  }
  console.error(`FAIL: ${findings.length} versioned credential finding(s); values redacted`);
  process.exit(1);
}

console.log('OK: 0 versioned password, service secret, or complete signed bilan token');
