# Remove domain-substring console exemption

Date: 2026-10-04. CodeQL #59–#63 report incomplete URL-substring sanitization in five console-error filters. These values are free-form console messages, not authenticated external request URLs. A domain occurrence cannot justify discarding the whole error. The five googletagmanager.com exemptions are removed, leaving the existing zero-error assertions stronger. No timeout, browser, test or assertion is removed. Other existing noise filters remain and require separate qualification; this change does not claim all console policy is qualified.

ESLint checks the actual E2E files with --no-ignore: zero errors, one pre-existing unused expectedH1 warning. No product behavior changes. Browser execution and remote CodeQL alert instances must still be verified on the published SHA. No fabricated red/green product regression is claimed for a strengthened E2E assertion.
