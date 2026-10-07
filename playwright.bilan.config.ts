import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir:'./e2e',testMatch:'espace-bilan.spec.ts',fullyParallel:false,workers:1,retries:0,timeout:90000,reporter:[['list']],outputDir:'test-results/bilan',use:{baseURL:'http://127.0.0.1:3017',trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}]});
