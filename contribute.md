# Contribute to the Fluent State project

Thank you for wanting to contribute to the Fluent State project. With your contributions we can ensure Fluent State remains a leading solution for state machines within JavaScript projects

## Steps for success

1. [Issues](https://github.com/2Toad/fluent-state/issues):
   1. Always work off of an Issue. Please do not submit a Pull Request that is not associated with an Issue (create the Issue if necessary).
   2. If you are beginning work on an Issue, please leave a comment on the issue letting us know, and we'll assign the Issue to you. This way somebody else won't start working on the same Issue.
2. [Branches](https://github.com/2Toad/fluent-state/branches):
   1. Always branch off of `master`, which contains the latest version of Fluent State
3. [Pull Request](https://github.com/2Toad/fluent-state/pulls) (PR):
   1. Make sure you run the following scripts in local, and that all of them pass, before submitting a PR:
      1. `npm run lint`
      2. `npm run prettier`
      3. `npm test`
      4. `npm run build`
   2. Make sure your PR is targeting the correct branch (see Step 2.i)
   3. At the top of your PR description write: "Fixes #_n_". Where _n_ is the number of the Issue your PR is fixing (e.g., `Fixes #33`). This will tell GitHub to associate your PR with the Issue.

## Development 

### Prerequisites

- Node: [Node 12+](https://nodejs.org)

### Source Code

1. Clone the repo
2. Change directories: `cd fluent-state`
3. Install dependencies: `npm i`

### Development

Start app in watch mode: `npm run local`

>When file changes are detected, the app will automatically rebuild/restart

#### Linting

- Check lint rules: `npm run lint`
- Fix lint errors: `npm run lint:fix`
- Check formatting rules: `npm run prettier`
- Fix formatting errors: `npm run prettier:fix`

## Appendix

### Dev Tools

The following section includes optional dev tools that enhance the Fluent State development experience, but are not necessary.

#### NVM

The Fluent State project includes an .nvmrc file, so you can run `nvm use` to switch to the proper version of Node.

##### Setup

1. Install nvm: https://github.com/nvm-sh/nvm
2. Install the Node.js version required by this app: `nvm install`
   1. NVM will determine the required Node version using the .nvmrc file
   2. NVM will install the required Node version if it isn't installed
   3. NVM will set your current Node version to the one required

#### Git Hooks

The Fluent State project includes Husky for running Git Hooks. Running `git commit` will trigger `lint-staged` which will lint all files currently staged in Git. If linting fails, the commit will be cancelled

##### Setup

1. Install husky: `npx husky install`
2. Give Husky permission: `sudo chmod -R +x .husky`
