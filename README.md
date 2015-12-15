## Setup environment

```bash
npm install --save-dev gulp
npm install --save-dev gulp-concat gulp-uglify gulp-rename
```

## Download it using bower

```bash
bower install DegSharepointUtilities
```

# Directives
* Automatically resize app part iframes

`<ng-app-frame></ng-app-frame>`

* People Picker 

`<div ng-people-picker accounttype='SPGroup'></div>`

`<div ng-people-picker accounttype='User'></div>`

* Directive for client ribbon bar
* Utilities for SharePoint property bag management
* CRUD List Operations
* Field and Content Types provisioning
* Helpers for creating and publishing Files
* App Context Helpers (AppUrl, HostUrl, currentUser, etc)


# Common (shpCommon)
* GetFormDigest

    When using REST, you need to add a client side token to validate posts back to SharePoint. This token is usually know as *Form Digest*. This service receives a callback function that is inkoked after the operation is completed. The function receives a a JavaScript object as a parameter whose properties depend on the operation's outcome. If successful, the Object is `{ error: false, requestDigest: requestDigest }`, whereas a failure generates this Object: `{ error: true, errorMessage: .. }`.

    ```js
    spService.Utilities.GetFormDigest(function (result) {
        if (!result.error) {
            var formDigest = result.requestDigest;
            ..
        }
    });
    ```

* SPAppWebUrl
    
    This service returns the app web by reading the value *SPAppWebUrl* from the query string

    ```js
    var appWebUrl = spService.Utilities.SPAppWebUrl();
    ```

* SPHostUrl
    
    This service returns the host web by reading the value *SPHostUrl* from the query string

    ```js
    var hostWebUrl = spService.Utilities.SPHostUrl();
    ```

* HostWebContext

    SharePoint Hosted apps can access data in their host webs, as long as the permissions have been set and the cross-domain library is being used. If these two conditions are met, then you can access information on the host web by using a SP.ClientContext object, which is returned by this service.

    ```js
    var context = spService.Utilities.HostWebContext();
    ```

* GetQsParam

    This service receives a name as a parameter, and returns the proper query string value.

    ```js
    var resultsPerPage = spService.Utilities.GetQsParam("ResultsPerPage");
    ```

* GetRelativeUrlFromAbsolute
    
    Receives an absolute Url and returns a relative one.

    ```js
    var absoluteUrl = '..';
    var relativeUrl = spService.Utilities.GetRelativeUrlFromAbsolute(absoluteUrl);
    ```

# ContentType (shpContentType)
* CreateAtHost: Creates a content type in root site.
    ```js
    ```

# Item (shpItem)
* Create
    ```js
    ```

* GetAll
    ```js
    ```

* Update
    ```js
    ```

# List (shpList)
* CreateAtHost

    ```js
    var contactList = "Contacts";
    spService.Lists.CreateAtHost(contactList, createFields);
    ```

* AddFieldToListAtHost

    ```js
    //Generic example
    spService.Lists.AddFieldToListAtHost(LISTNAME, DISPLAYNAME, INTERNALNAME, bool:REQUIRED, TYPE, FIELD EXTRA, function:CALLBACK)

    var createFields = function () {
        //Text
        spService.Lists.AddFieldToListAtHost(contactList, "Email", "fuseEmail", false, "Text", "", null)
        .then(function () {
            //User
            return spService.Lists.AddFieldToListAtHost(contactList, "User", "fuseUser", false, "User", "", null);
        })
        .then(function () {
            //Image
            return spService.Lists.AddFieldToListAtHost(contactList, "Picture", "fusePic", false, "URL", "Image", null);
        })
        .then(function () {
            //Hyperlink
            return spService.Lists.AddFieldToListAtHost(contactList, "Profile Page", "fuseLink", false, "URL", "Hyperlink", null);
        })
        .then(function () {
            //TaxonomyFieldType
            return spService.Lists.AddFieldToListAtHost(contactList, "Enterprise Keywords", "TaxKeyword", false, "TaxonomyFieldType", null, null);
        });
    };
    ```

* Exist

    ```js
    spService.Lists.Exist(contactList, function () {
        ..
    });
    ```

# Column (shpColumn)
* CreateAtHost

# File (shpFile)
* CreateAtHost

    Using SharePoint Hosted Apps, you can provision fields/content Directive for client ribbon bar /files to the host web, as long as the app meets these two requirements:
    * The app requests (and is granted) “Full Control” permission of the host web
    * CSOM code is used for provisioning, rather than standard Feature XML

    For that purpose, we first povision the file to our app web using a Module element. The file itself, needs to be saved as a txt file. Please find more information about this on [this link](http://www.sharepointnutsandbolts.com/2013/05/sp2013-host-web-apps-provisioning-files.html).
    Assuming we have an .xsl file, saved as *UpcomingEvents.txt* in a Module *XSL*, and we want to provision this to the *XSL Style Sheets* folder under *Style Library*, we can use the following service:

    ```js
    var isPublisRequired = false;
    var appWebUrl = spService.Utilities.SPAppWebUrl();
    spService.Files.CreateAtHost(appWebUrl + '/XSL/UpcomingEvents.txt', 'Style Library/XSL Style Sheets', 'UpcomingEvents.xsl', isPublisRequired,
        function (result) {
            ..
        }
    );
    ```

    Value of *isPublisRequired* will depend on the type of the file that is being provisioned. For instance, .xsl files need to be published, while .webpart files don't.

* LoadAtHost

    This service returns an Object that indicates if a file exists in a certain location of the host web. It receives as parameters the file's relative Url, and a callback function that will be invoked, and returns an Object with two properties: `{ Success: boolean, Message: string}`.
    
    The value of `Success` will depend on whether the file was found.

    ```js
    spService.Files.LoadAtHost(fileRelativeUrl, function (result) {
        var fileExists = result.Success;
        ..
    });
    ```

* CheckOutAtHost

    Before a file is provisioned to the host web, it first needs to be checked out (if versioning applies to the file). It receives as parameters the file's relative Url, and a callback function that will be invoked, and returns an Object with two properties: `{ Success: boolean, Message: string}`
    
    The value of `Success` will depend on whether the file was successfully checked out.

    ```js
    spService.Files.CheckOutAtHost(fileRelativeUrl, function (result) {
        var isFileCheckedOut = result.Success;
        ..
    });
    ```

* PublishFileToHost

    After a file is checked out, it needs to be published. This service receives the file's relative Url and checks whether that file exists, and if it's checked out. If that occurs, the file in the host web is published and the callback function is called. The function receives an Object with two properties: `{ Success: boolean, Message: string}`.
    
    The value of `Success` will depend on whether the file was successfully published.

    ```js
    spService.Files.PublishFileToHost(fileRelativeUrl, function (result) {
        if (callback) callback(result);
    });
    ```

* UploadFileToHostWeb

    This service is useful if a file already exists in the app web, as opposed to being provisioned using a Module element, and you'd like to move it to the host web. First, you'll need to make a $http GET request to the .txt file in the app web in order to obtain its contents.

    ```js
    $http.get(appWebFileUrl).
        success(function (fileContents) {
            if (fileContents !== undefined && fileContents.length > 0) {
                spService.Files.UploadFileToHostWeb(serverRelativeUrl, fileName, fileContents, isPublishRequired, callback);
            }
        }).error(function (data, status) {
            ..
        });
    ```

# Group (shpGroup)
* LoadAtHost
    
    This service receives a group name as a parameter and a callback function that will be invoked after the operation is performed. This function receives a JavaScript Object with two properties: `{ Success: boolean, Message: string}`, indicating whether the operation was successful, and further information about the error in case it failed.


    ```js
    spService.Groups.LoadAtHost("FUSE Picture Gallery Admins",
        function (result) { 
            .. 
        }
    );
    ```

* CreateAtHost

    Use this service to create a new SharePoint group in the host web.

    ```js
    spService.Groups.CreateAtHost("FUSE Picture Gallery Admins");
    ```

* IsCurrentUserMember

    This service checks whether the current (logged) user is member of a SharePoint group, and invokes a callback function with a JavaScript Object with two properties: `{ Success: boolean, Message: string}` as a paramter, indicating whether the operation was successful, and further information about the error in case it failed.

    ```js
    spService.Groups.IsCurrentUserMember('FUSE Picture Gallery Admins',
        function (result) {
            ..
        }
    );
    ```

# PropertyBag (shpPropertyBag)
* SaveObjToCurrentWeb
* SaveObjToRootWeb
* GetValue

# Taxonomy (shpTaxonomy)
* GetTermSetValues

    ```js
    spService.Taxonomy.GetTermSetValues("FUSE", "FUSE Business Units", function (termStoreValues) { 
    ..
    });
    ```

# User (shpUser)
* GetCurrentUserName

    This service retrieves the current user's name, and invokes a callback function with this value as a parameter. If the operation fails, the error is logged to the browser's console.

    ```js
    spService.User.GetCurrentUserName(function (userName) {
        ..
    });
    ```

* GetCurrent

    If you need to retrieve a different property from the user rather than it's user name, you can user this service to get a SP.User object. If you'd like to get the user's email, you can then use the following method: `user.get_email()`

    ```js
    spService.User.GetCurrent(function (user) {
        ..
    });
    ```

* GetId

    This service receives a user's login name and a callback function which will be invoked with the user's Id if the operation is successful. Otherwise, the error is logged to the browser's console.

    ```js
    spService.User.GetId(loginName, function (userId) {
        ..
    });
    ```

* GetCurrentUserProfileProperties

    Using the SP.UserProfiles.PeopleManager object, this service returns a Promise object. Handlers need to be added to be called when the object is resolved or rejected.

    ```js
    spService.User.GetCurrentUserProfileProperties().then(
        function (data) {
            ..
        },
        function (data) {
        }
    );
    ```