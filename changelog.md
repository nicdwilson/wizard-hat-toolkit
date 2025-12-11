## Changelog

> **Note:** Jurassic Tube feature has been deprecated and removed as of the latest version.

### 1.7.0
* UI improvements: Hide selection dropdown and install/update buttons during repository refresh on initial tab launch
* Add spinner to repository refresh status notice for better visual feedback
* Remove GitHub token prompt and validation logic (no longer needed with Git-based approach)
* Remove deprecated Jurassic Tube feature and all related code
* Update dependencies

### 1.2.2
* Ignore woocommerce-shipstation from all-plugins repo
* Adds node request package to replace context.replace


### 1.2.1
* Don't limit JT port assignment to nginx (deprecated - Jurassic Tube removed)

### 1.2
* Week 3 section added with some content
* Jurassic Tube feature added (deprecated - feature removed)


### 1.1.1
* Dark mode CSS added
* Shop config button spinners detached from one another
* Week 2 day 5 can now also install plugins
* Moved checks for valid GH token to the points where blockage actually happens
* Add U.K. to switcheroo button array
* Add gerund to button when active


### 1.1
 * Troubleshooting excercise added
  
### 1.1-beta.2 TBD
* Week 2 Day 1 content added.
* Week 2 Day 2 content added.
* Install WooCommerce and demo content
* download any given plugin from the all-plugins repo

### 1.1-beta 16 March 2022
* Add functionality to validate GH tokens against the `repo` scope.
* Provide an interface to enter a GH token
* Conditionally render content based on site running and valid GH token
* Added octokit dependency
* Added @terascope/fetch-github-release dependency
* Added functionality to download a zip release from a private GH repo.
* Un-broke CSS on Local's "more" menu
* Interface elements added

### 1.0.1 6 Mar 2022
* Fork of POC https://github.com/WillBrubaker/woo-locale-switcher