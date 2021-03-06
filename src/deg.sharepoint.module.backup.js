/** 
* @version 0.3
* @license MIT
* by Nick Aranzamendi 
* Contributors: Andres Baez, Gonzalo Barbitta
*/

'use strict';
angular.module("Deg.SharePoint", []).service('spService', ['$http', '$log', '$q', function ($http, $log, $q) {
    return {
        User: {
            GetCurrentUserName: getUserName,
            GetCurrent: getCurrentUser,
            GetId: getUserId,
            GetCurrentUserProfileProperties: getCurrentUserProperties
        },
        CtxInfo: {
            SPAppWebUrl: getAppWebUrl(),
            //SPContextInfo: _spPageContextInfo,
            SPHostUrl: getHostWebUrl()
        },
        PropBag: {
            SaveObjToCurrentWeb: saveObjToCurrentWebPropertyBag,
            SaveObjToRootWeb: saveObjToRootWebPropertyBag,
            GetValue: getPropertyBagValue,
        },
        Utilities: {
            GetQsParam: getUrlParam,
            GetFormDigest: getFormDigest
        },
        Lists: {
            CreateAtHost: createListInHost,
            AddFieldToListAtHost: addFieldToRootList,
            Exist: existRootList
        },
        Items: {
            Create: createListItem,
            GetAll: getAllItems,
            Update: updateListItem
        },
        Columns: {
            CreateAtHost: createRootField
        },
        CTypes: {
            CreateAtHost: createContentTypeInHost
        },
        Files: {
            CreateAtHost: readFromAppWebAndProvisionToHost,
            LoadAtHost: loadFileAtHostWeb,
            CheckOutAtHost: checkOutFileAtHostWeb,
            PublishFileToHost: publishFileToHostWeb
        },
        Groups: {
            LoadAtHost: loadGroupAtHostWeb,
            CreateAtHost: createGroupAtHostWeb,
            IsCurrentUserMember: isCurrentUserMemberOfGroup
        },
        Taxonomy: {
            GetTermSetValues: getTermSetValues
        }
    };
    function createCtype(cTypeInfo, callback, sPCtx) {
        var ctx = sPCtx || clientCtx;
        var web = ctx.get_web();
        var ctypes = web.get_contentTypes();
        var creationInfo = new SP.ContentTypeCreationInformation();
        creationInfo.set_name(cTypeInfo.Name);
        creationInfo.set_description(cTypeInfo.Description);
        creationInfo.set_group(cTypeInfo.Group);
        if (cTypeInfo.ParentContentType && cTypeInfo.ParentContentType != '') {
            var parent = ctypes.getById(cTypeInfo.ParentContentType);
            creationInfo.set_parentContentType(parent);
        }
        ctypes.add(creationInfo);
        ctx.load(ctypes);
        ctx.executeQueryAsync(onProvisionContentTypeSuccess, onProvisionContentTypeFail);
        function onProvisionContentTypeSuccess() {
            if (callback)
                callback(creationInfo);
        }
        function onProvisionContentTypeFail(sender, args) {
            $log.log("Error: " + args.get_message());
        }
    }
    
    function getRequestDigest() {
        
        var promise = $http({
            method: "POST",
            url: "/_api/contextinfo",
            data: {
                "query":
                {
                    "__metadata": { "type": "SP.CamlQuery" },
                    "ViewXml": ""
                }
            },
            headers: {
                "accept": "application/json; odata=verbose",
                "contentType": "text/xml"
            }
        })
        .then(
            function (data) {
                return  data.data.d.GetContextWebInformation.FormDigestValue;
            },
            function (err) { alert(JSON.stringify(err)); }
        );

        return promise;
    };
    
    // ctypeInfo { Name :'', Description : '', Group: '', ParentContentType: 'optional'}
    function createContentTypeInHost(cTypeInfo, callback) {
        var hostWebContext = getHostWebContext();
        createCtype(cTypeInfo, callback, hostWebContext);
    }

    function getCurrentUserProperties() {
        
        var deferred = $q.defer();
        
        var clientContext = SP.ClientContext.get_current();
        
        var peopleManager = new SP.UserProfiles.PeopleManager(clientContext);

        var userProfileProperties = peopleManager.getMyProperties();

        clientContext.load(userProfileProperties);
        clientContext.executeQueryAsync(
            function () {
                deferred.resolve(userProfileProperties.get_userProfileProperties());
            },
            function (data) {
                console.log(data);
                deferred.reject(data);
                console.log("Error");
            }
        );

        return deferred.promise;

    }

    function getAllItems(listName, _query, extend) {

        var deferred = $q.defer();
        
        var query = (_query) ? _query : '<View><Query></Query></View>';
        //Get URLs
        var hostUrl = getHostWebUrl();
        var appweburl = getAppWebUrl();
        //Get Contexts
        var appContext = new SP.ClientContext(appweburl);
        var hostContext = new SP.AppContextSite(appContext, hostUrl);

        var oList = hostContext.get_web().get_lists().getByTitle(listName);

        var camlQuery = new SP.CamlQuery();
        camlQuery.set_viewXml(query);

        var oListItems = oList.getItems(camlQuery);

        appContext.load(oListItems);
        appContext.executeQueryAsync(
            Function.createDelegate(this, function () {
                var entries = [];
                var itemsCount = oListItems.get_count();
                for (var i = 0; i < itemsCount; i++) {
                    var item = oListItems.itemAt(i);
                    entries.push(item.get_fieldValues());
                }
                deferred.resolve(entries);
            }),
            Function.createDelegate(this, function () {
                deferred.reject('An error has occurred when retrieving items');
            })
        );
        
        return deferred.promise;
    }

    function updateListItem(listName, listItemId, listProperties) {
        var deferred = $q.defer();

        var appContext = new SP.ClientContext(getAppWebUrl());
        var hostContext = new SP.AppContextSite(appContext, getHostWebUrl());

        var oList = hostContext.get_web().get_lists().getByTitle(listName);
        var oListItem = oList.getItemById(listItemId);

        angular.forEach(listProperties, function (value, key) {
            oListItem.set_item(key, value);
        });
        oListItem.update();

        appContext.executeQueryAsync(
            Function.createDelegate(this, function () { deferred.resolve(); }),
            Function.createDelegate(this, function () { deferred.reject('An error has occurred when updating the item.'); })
        );

        return deferred.promise;
    }

    function createListItem(listName, listProperties, callback) {

        //Get URLs
        var hostUrl = getHostWebUrl();
        var appweburl = getAppWebUrl();
        //Get Contexts
        var appContext = new SP.ClientContext(appweburl);
        var hostContext = new SP.AppContextSite(appContext, hostUrl);
        //Get root web
        var oList = hostContext.get_web().get_lists().getByTitle(listName);

        var itemCreateInfo = new SP.ListItemCreationInformation();
        var oListItem = oList.addItem(itemCreateInfo);

        angular.forEach(listProperties, function (value, key) {
            if (value == "currentuser") {
                var current = hostContext.get_web().get_currentUser();
                oListItem.set_item(key, current);
            } else {
                oListItem.set_item(key, value);
            }

        });
        oListItem.update();

        appContext.load(oListItem);
        appContext.executeQueryAsync(
            function (sender, args) {
                checkCallback();
            },
            function (sender, args) {
                $log.log('Request failed. ' + args.get_message() + '\n' + args.get_stackTrace());
            }
        );
        function checkCallback() {
            if (callback) {
                callback();
            }
        }
    }

    function createListInHost(listName, callback, listTemplate) {
        var deferred = $q.defer();
        //Get URLs
        var hostUrl = getHostWebUrl();
        var appweburl = getAppWebUrl();
        //Get Contexts
        var appContext = new SP.ClientContext(appweburl);
        var hostContext = new SP.AppContextSite(appContext, hostUrl);
        //Get root web
        var oWebsite = hostContext.get_web();

        //Create list
        var listCreationInfo = new SP.ListCreationInformation();
        listCreationInfo.set_title(listName);
        listCreationInfo.set_templateType(listTemplate);

        var oList = oWebsite.get_lists().add(listCreationInfo);

        appContext.load(oList);
        appContext.executeQueryAsync(
            function (sender, args) {
                checkCallback();
            },
            function (sender, args) {
                $log.log('Request failed. ' + args.get_message() + '\n' + args.get_stackTrace());
                deferred.reject("Error creating " + listName + " at host.");
            }
        );

        function checkCallback() {
            if (callback) {
                callback();
            }
            deferred.resolve();
        }
    }

    function existRootList(listName, callback) {
        var deferred = $q.defer();
        //Get URLs
        var hostUrl = getHostWebUrl();
        var appweburl = getAppWebUrl();
        //Get Contexts
        var appContext = new SP.ClientContext(appweburl);
        var hostContext = new SP.AppContextSite(appContext, hostUrl);
        //Get root web
        var oList = hostContext.get_web().get_lists().getByTitle(listName);

        appContext.load(oList);
        appContext.executeQueryAsync(
            function (sender, args) {
                checkCallback();
                deferred.resolve();
            },
            function (sender, args) {
                $log.log('Request failed. ' + args.get_message() + '\n' + args.get_stackTrace());
                deferred.reject();
            }
        );

        function checkCallback() {
            if (callback) {
                callback();
            }

        }

        return deferred.promise;
    }

    function addFieldToRootList(listName, fieldDisplayName, fieldName, required, fieldType, fieldExtra, callback) {

        var deferred = $q.defer();
        //Get URLs
        var hostUrl = getHostWebUrl();
        var appweburl = getAppWebUrl();
        //Get Contexts
        var appContext = new SP.ClientContext(appweburl);
        var hostContext = new SP.AppContextSite(appContext, hostUrl);
        //Get root web
        var oList = hostContext.get_web().get_lists().getByTitle(listName);

        var extraTypeDefinition = "";
        switch (fieldType) {
            case "URL":
            case "DateTime":
                if (fieldExtra != "")
                    extraTypeDefinition = "Format=\'" + fieldExtra + "\'";
                break;
            case "Note":
                if (fieldExtra != "")
                    extraTypeDefinition = "RichText=\'" + ((fieldExtra) ? "TRUE" : "FALSE") + "\'";
                break;
            case "User":
                if (fieldExtra != "")
                    extraTypeDefinition = "UserSelectionMode=\'" + fieldExtra + "\'";
                break;
        }


        var requiredTxt = (required) ? "TRUE" : "FALSE";
        var fieldDefinition = "<Field DisplayName=\'" + fieldDisplayName + "\' Name=\'" + fieldName + "\' Required=\'" + requiredTxt + "\' Type=\'" + fieldType + "\' " + extraTypeDefinition + "/>";
        var oField = oList.get_fields().addFieldAsXml(
            fieldDefinition,
            true,
            SP.AddFieldOptions.addFieldInternalNameHint
        );

        appContext.load(oField);

        switch (fieldType) {
            case "Choice":
                var fieldConverted = appContext.castTo(oField, SP.FieldChoice);
                fieldConverted.set_choices(fieldExtra);
                fieldConverted.update();
                appContext.executeQueryAsync(
                    function (sender, args) {
                        checkCallback();
                    },
                    function (sender, args) {
                        $log.log('Request failed. ' + args.get_message() + '\n' + args.get_stackTrace());
                        deferred.reject();
                    }
                );
                break;
            case "TaxonomyFieldType":
            case "TaxonomyFieldTypeMulti":
                if (fieldExtra) {
                    var session = SP.Taxonomy.TaxonomySession.getTaxonomySession(appContext);
                    var store = session.getDefaultSiteCollectionTermStore();
                    var group = store.get_groups().getByName(fieldExtra.TaxonomyGroup);
                    var set = group.get_termSets().getByName(fieldExtra.TaxonomySet);

                    appContext.load(store, "Id");
                    appContext.load(set, "Id");
                    appContext.executeQueryAsync(
                        function (sender, args) {
                            var fieldConverted = appContext.castTo(oField, SP.Taxonomy.TaxonomyField);
                            fieldConverted.set_sspId(store.get_id());
                            fieldConverted.set_termSetId(set.get_id());
                            fieldConverted.set_createValuesInEditForm(fieldExtra.CreateValuesInEditForm);
                            fieldConverted.set_allowMultipleValues(fieldExtra.AllowMultipleValues);
                            fieldConverted.update();
                            appContext.executeQueryAsync(
                                function (sender, args) {
                                    checkCallback();
                                },
                                function (sender, args) {
                                    $log.log('Request failed. ' + args.get_message() + '\n' + args.get_stackTrace());
                                    deferred.reject();
                                }
                            );
                        },
                        function (sender, args) {
                            alert("Error creating TaxonomyFieldType");
                        }
                    );
                }

                break;
            default:
                appContext.executeQueryAsync(
                    function (sender, args) {
                        checkCallback();
                    },
                    function (sender, args) {
                        $log.log('Request failed. ' + args.get_message() + '\n' + args.get_stackTrace());
                        deferred.reject();
                    }
                );
                break;
        }

        function checkCallback() {
            if (callback) {
                callback();
            }
            deferred.resolve();
        }
        return deferred.promise;
    }


    function createRootField(fieldsXml, callback) {
        var hostWebContext = getHostWebContext();
        createFields(fieldsXml, callback, hostWebContext);
    }
    function getHostWebContext() {
        var hostUrl = getHostWebUrl();
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostUrl));
        return hostWebContext;
    }

    function createFields(fieldsXml, callback, sPCtx) {
        var clientCtx = SP.ClientContext.get_current();
        // field XML format :: <Field DisplayName='Field Name' Name='NoSpaceName' ID='{2d9c2efe-58f2-4003-85ce-0251eb174096}' Group='Group Name' Type='Text' />
        var ctx = sPCtx || clientCtx;
        var fieldsExecuted = 0
        var fields = ctx.get_web().get_fields();
        var response = {
            ErrorMessages: [],
            Fields: []
        };
        for (var x = 0; x < fieldsXml.length; x++) {
            var newField = fields.addFieldAsXml(fieldsXml[x], false, SP.AddFieldOptions.AddToNoContentType);
            ctx.load(newField);
            response.Fields.push(newField);
            // executing one by one because process stops if one field errors out when queuing all
            ctx.executeQueryAsync(function () {
                $log.log("Field provisioned in host web successfully");
                checkCallback();
            }, function (sender, args) {
                $log.log('Failed to provision field into host web.');
                response.ErrorMessages.push(args.get_message())
                checkCallback();
            });
        }
        function checkCallback() {
            fieldsExecuted++;
            if (callback && fieldsXml.length === fieldsExecuted) {
                callback(response);
            }
        }
    }
    function getUserName(callback) {
        try {
            var clientCtx = SP.ClientContext.get_current();
            var user = clientCtx.get_web().get_currentUser();
            clientCtx.load(user);
            clientCtx.executeQueryAsync(onGetUserNameSuccess, onGetUserNameFail);
        }
        catch (e) {
            callback(null);
        }
        function onGetUserNameSuccess() {
            var userName = user.get_title();
            callback(userName);
        }
        function onGetUserNameFail(sender, args) {
            $log.log('Failed to get user name. Error:' + args.get_message());
        }
    }

    function getCurrentUser(callback) {
        var context = SP.ClientContext.get_current();
        var user = context.get_web().get_currentUser();

        context.load(user);
        context.executeQueryAsync(onGetUserNameSuccess, onGetUserNameFail);

        function onGetUserNameSuccess() {
            if (callback) callback(user);
        }
        function onGetUserNameFail(sender, args) {
            $log.log('Failed to get user. Error: ' + args.get_message());
        }
    }

    function getUserId(loginName, callback) {
        var context = SP.ClientContext.get_current();
        var user = context.get_web().ensureUser(loginName);
        context.load(user);
        context.executeQueryAsync(onEnsureUserSuccess, onEnsureUserFail);

        function onEnsureUserSuccess() {
            if (callback) callback(user.get_id());
        }

        function onEnsureUserFail(sender, args) {
            $log.log('Failed to ensure user. Error: ' + args.get_message());
        }
    }

    function getAppWebUrl() {
        return decodeURIComponent(getUrlParam("SPAppWebUrl"));
    }
    function getHostWebUrl() {
        return decodeURIComponent(getUrlParam("SPHostUrl"));
    }

    function getPropertyBagValue(key, callback, optionalWebUrl) {
        var rootPath = optionalWebUrl || getAppWebUrl();
        var url = rootPath + '/_api/web/AllProperties?$select=' + key;

        $http.get(url).
            success(function (result) {
                var value = "";
                if (result[key])
                    value = result[key];
                callback(value);
            }).
            error(function (data, status) {
                $log.log(status);
                $log.log(data);
            });
    }

    function saveObjToCurrentWebPropertyBag(jsonObject, callback) {
        var oWebsite = clientCtx.get_web();
        savePropertyBag(oWebsite, jsonObject, callback)

    }
    function saveObjToRootWebPropertyBag(jsonObject, callback) {
        var oWebsite = clientCtx.get_site().get_rootWeb();
        savePropertyBag(oWebsite, jsonObject, callback);
    }
    function savePropertyBag(oWebsite, obj, callback) {
        clientCtx.load(oWebsite);
        var props = oWebsite.get_allProperties();
        for (var property in obj) {
            if (obj.hasOwnProperty(property)) {
                props.set_item(property, obj[property]);
            }
        }
        oWebsite.update();
        clientCtx.load(oWebsite);
        clientCtx.executeQueryAsync(onQuerySucceeded, onQueryFailed);

        function onQuerySucceeded() {

            if (callback)
                callback();
            else
                $log.log("Properties saved");
        }
        function onQueryFailed(sender, args) {
            $log.log('Request failed. ' + args.get_message() +
                '\n' + args.get_stackTrace());
        }
    }

    /** File **/
    function readFromAppWebAndProvisionToHost(appWebFileUrl, serverRelativeUrl, fileName, isPublishRequired, callback) {
        $http.get(appWebFileUrl).
            success(function (fileContents) {
                if (fileContents !== undefined && fileContents.length > 0) {
                    if (!isPublishRequired) {
                        uploadFileToHostWeb(serverRelativeUrl, fileName, fileContents, isPublishRequired, callback);
                    }
                    else {
                        var fileRelativeUrl = serverRelativeUrl + '/' + fileName;
                        loadFileAtHostWeb(fileRelativeUrl, function (result) {
                            var fileExists = result.Success;
                            if (!fileExists) {
                                uploadFileToHostWeb(serverRelativeUrl, fileName, fileContents, isPublishRequired, callback);
                            }
                            else {
                                checkOutFileAtHostWeb(fileRelativeUrl, function (result) {
                                    if (result.Success) {
                                        uploadFileToHostWeb(serverRelativeUrl, fileName, fileContents, isPublishRequired, callback);
                                    }
                                    else {
                                        if (callback) callback(result);
                                    }
                                });
                            }
                        });
                    }
                }
                else {
                    if (callback) callback({ Success: false, Message: 'Failed to read file from app web.' });
                }
            }).error(function (data, status) {
                if (callback) callback({ Success: false, Message: 'Request for file in app web failed: ' + status });
            });
    }

    function uploadFileToHostWeb(serverRelativeUrl, fileName, contents, isPublishRequired, callback) {
        var hostWebUrl = getHostWebUrl();
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostWebUrl));

        var createInfo = new SP.FileCreationInformation();
        createInfo.set_content(new SP.Base64EncodedByteArray());
        for (var i = 0; i < contents.length; i++) {
            createInfo.get_content().append(contents.charCodeAt(i));
        }
        createInfo.set_overwrite(true);
        createInfo.set_url(fileName);
        var files = hostWebContext.get_web().getFolderByServerRelativeUrl(serverRelativeUrl).get_files();
        hostWebContext.load(files);
        files.add(createInfo);

        hostWebContext.executeQueryAsync(onProvisionFileSuccess, onProvisionFileFail);

        function onProvisionFileSuccess() {
            var fileRelativeUrl = serverRelativeUrl + '/' + fileName;
            if (isPublishRequired) {
                publishFileToHostWeb(fileRelativeUrl, function (result) {
                    if (callback) callback(result);
                });
            }
            else {
                if (callback) callback({ Success: true, Message: 'File published in host web successfully: ' + fileRelativeUrl });
            }
        }
        function onProvisionFileFail(sender, args) {
            if (callback) callback({ Success: false, Message: 'Failed to provision file into host web. Error: ' + sender.statusCode });
        }
    }

    function checkOutFileAtHostWeb(fileRelativeUrl, callback) {
        var hostWebUrl = getHostWebUrl();
        var serverRelativeUrl = getRelativeUrlFromAbsolute(hostWebUrl);
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostWebUrl));

        var fileUrl = serverRelativeUrl + fileRelativeUrl;
        var file = hostWebContext.get_web().getFileByServerRelativeUrl(fileUrl);
        hostWebContext.load(file);

        hostWebContext.executeQueryAsync(onLoadFileSuccess, onLoadFileFail);

        function onLoadFileSuccess() {
            var isCheckedOut = file.get_checkOutType() == 0;
            if (!isCheckedOut) {
                file.checkOut();
                hostWebContext.executeQueryAsync(onCheckoutFileSuccess, onCheckoutFileFail);
            }
            else {
                if (callback) callback({ Success: true, Message: 'File checked out in host web successfully: ' + fileRelativeUrl });
            }
        }
        function onLoadFileFail(sender, args) {
            if (callback) callback({ Success: false, Message: 'Failed to read file from host web. Error: ' + sender.statusCode });
        }
        function onCheckoutFileSuccess() {
            if (callback) callback({ Success: true, Message: 'File checked out in host web successfully: ' + fileRelativeUrl });
        }
        function onCheckoutFileFail(sender, args) {
            if (callback) callback({ Success: false, Message: 'Failed to checkout file at host web. Error: ' + sender.statusCode });
        }
    }

    function publishFileToHostWeb(fileRelativeUrl, callback) {
        var hostWebUrl = getHostWebUrl();
        var serverRelativeUrl = getRelativeUrlFromAbsolute(hostWebUrl);
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostWebUrl));

        var fileUrl = serverRelativeUrl + fileRelativeUrl;
        var file = hostWebContext.get_web().getFileByServerRelativeUrl(fileUrl);
        hostWebContext.load(file);

        hostWebContext.executeQueryAsync(onLoadFileSuccess, onLoadFileFail);

        function onLoadFileSuccess() {
            var isCheckedOut = file.get_checkOutType() == 0;
            if (!isCheckedOut) {
                file.checkIn();
                file.publish();
                hostWebContext.executeQueryAsync(onPublishFileSuccess, onPublishFileFail);
            }
            else {
                if (callback) callback({ Success: true, Message: 'File published in host web successfully: ' + fileRelativeUrl });
            }
        }
        function onLoadFileFail(sender, args) {
            if (callback) callback({ Success: false, Message: 'Failed to read file from host web. Error: ' + sender.statusCode });
        }
        function onPublishFileSuccess() {
            if (callback) callback({ Success: true, Message: 'File published in host web successfully: ' + fileRelativeUrl });
        }
        function onPublishFileFail(sender, args) {
            if (callback) callback({ Success: false, Message: 'Failed to publish file into host web. Error: ' + sender.statusCode });
        }
    }

    function loadFileAtHostWeb(fileRelativeUrl, callback) {
        var hostWebUrl = getHostWebUrl();
        var serverRelativeUrl = getRelativeUrlFromAbsolute(hostWebUrl);
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostWebUrl));

        var fileUrl = serverRelativeUrl + fileRelativeUrl;
        var file = hostWebContext.get_web().getFileByServerRelativeUrl(fileUrl);
        hostWebContext.load(file);

        hostWebContext.executeQueryAsync(onLoadFileSuccess, onLoadFileFail);

        function onLoadFileSuccess() {
            if (callback) callback({ Success: true, Message: 'File loaded from host web successfully: ' + fileUrl });
        }
        function onLoadFileFail(sender, args) {
            if (callback) callback({ Success: false, Message: 'Failed to read file from host web. Error: ' + sender.statusCode });
        }
    }

    /** Groups **/
    function loadGroupAtHostWeb(groupName, callback) {
        var hostWebUrl = getHostWebUrl();
        var serverRelativeUrl = getRelativeUrlFromAbsolute(hostWebUrl);
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostWebUrl));

        var groupCollection = hostWebContext.get_web().get_siteGroups();
        var group = groupCollection.getByName(groupName);
        hostWebContext.load(group);

        hostWebContext.executeQueryAsync(onGetGroupSuccess, onGetGroupFail);

        function onGetGroupSuccess() {
            if (callback) callback({ Success: true, Message: "Group loaded from host web successfully" });
        }
        function onGetGroupFail(data, args) {
            if (callback) callback({ Success: false, Message: "Failed to load group from host web. Error: " + args.get_message() });
        }
    }

    function createGroupAtHostWeb(groupName, callback) {
        var hostWebUrl = getHostWebUrl();
        var serverRelativeUrl = getRelativeUrlFromAbsolute(hostWebUrl);
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostWebUrl));

        var group = new SP.GroupCreationInformation();
        group.set_title(groupName);

        var oGroup = hostWebContext.get_web().get_siteGroups().add(group);
        hostWebContext.load(oGroup);

        hostWebContext.executeQueryAsync(onCreateGroupSuccess, onCreateGroupFail);

        function onCreateGroupSuccess() {
            if (callback) callback({ Success: true, Message: "Group created at host web successfully" });
        }
        function onCreateGroupFail(data, args) {
            if (callback) callback({ Success: false, Message: "Failed to create group at host web. Error: " + args.get_message() });
        }
    }

    function isCurrentUserMemberOfGroup(groupName, callback) {
        var hostWebUrl = getHostWebUrl();
        var serverRelativeUrl = getRelativeUrlFromAbsolute(hostWebUrl);
        var hostWebContext = new SP.ClientContext(getRelativeUrlFromAbsolute(hostWebUrl));

        var groupCollection = hostWebContext.get_web().get_siteGroups();
        var group = groupCollection.getByName(groupName);
        hostWebContext.load(group);

        var currentUser = hostWebContext.get_web().get_currentUser();
        hostWebContext.load(currentUser);

        var groupUsers = group.get_users();
        hostWebContext.load(groupUsers);

        hostWebContext.executeQueryAsync(onGetGroupsSuccess, onGetGroupsFailure);

        function onGetGroupsSuccess(sender, args) {
            var isUserInGroup = false;
            var groupUserEnumerator = groupUsers.getEnumerator();
            while (groupUserEnumerator.moveNext()) {
                var groupUser = groupUserEnumerator.get_current();
                if (groupUser.get_id() == currentUser.get_id()) {
                    isUserInGroup = true;
                    break;
                }
            }
            if (callback) callback({ Success: true, IsUserInGroup: isUserInGroup });
        }

        function onGetGroupsFailure(sender, args) {
            if (callback) callback({ Success: false, Message: "Failed to create group at host web. Error: " + args.get_message() });
        }
    }

    /** Taxonomy **/
    function getTermSetValues(taxonomyGroup, termSetName, callback) {
        var context = SP.ClientContext.get_current();

        var session = SP.Taxonomy.TaxonomySession.getTaxonomySession(context);
        var termStore = session.getDefaultSiteCollectionTermStore();
        var group = termStore.get_groups().getByName(taxonomyGroup);
        var termSet = group.get_termSets().getByName(termSetName);
        var terms = termSet.getAllTerms();

        context.load(terms);
        context.executeQueryAsync(
            function () {
                var values = [];
                var termEnumerator = terms.getEnumerator();
                while (termEnumerator.moveNext()) {
                    var currentTerm = termEnumerator.get_current();
                    values.push({ 'id': currentTerm.get_id(), 'name': currentTerm.get_name() });
                }
                if (callback) callback(values);
            },
            function (sender, args) {
                $log.log(args.get_message());
            }
        );
    }

    // Helpers
    function getUrlParam(key) {
        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for (var i = 0; i < hashes.length; i++) {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return vars[key];
    }
    function getRelativeUrlFromAbsolute(absoluteUrl) {
        absoluteUrl = absoluteUrl.replace('http://', '');
        absoluteUrl = absoluteUrl.replace('https://', '');
        var parts = absoluteUrl.split('/');
        var relativeUrl = '/';
        for (var i = 1; i < parts.length; i++) {
            relativeUrl += parts[i] + '/';
        }
        return relativeUrl;
    }
    function getFormDigest(callback) {
        $.ajax({
            url: getAppWebUrl() + "/_api/contextinfo",
            type: "POST",
            headers: {
                "accept": "application/json;odata=verbose",
                "contentType": "text/xml"
            },
            success: function (data) {
                var requestDigest = data.d.GetContextWebInformation.FormDigestValue;
                if (callback) callback({ error: false, requestDigest: requestDigest });
            },
            error: function (error) {
                if (callback) callback({ error: true, errorMessage: JSON.stringify(error) });
            }
        });
    }
}])
.directive('ngAppFrame', ['$timeout', '$window', function ($timeout, $window) {

    return {
        restrict: 'E',
        link: function (scope, element, attrs) {
            element.css("display", "block");
            scope.$watch
            (
                function () {
                    return element[0].offsetHeight;
                },
                function (newHeight, oldHeight) {

                    //if (newHeight != oldHeight) {
                    $timeout(function () {
                        if(typeof attrs.minheight == 'undefined'){
                            attrs.minheight = 50;
                        }
                        var height = attrs.minheight ? newHeight + parseInt(attrs.minheight) : newHeight;
                        var id = getQsParam("SenderId");
                        var message = "<message senderId=" + id + ">resize(100%," + height + ")</message>";
                        $window.parent.postMessage(message, "*");
                    }, 0);// timeout needed to wait for DOM to update
                    //}
                }
            );
        }
    };
    function getQsParam(name) {
        var match = RegExp('[?&]' + name + '=([^&]*)').exec($window.location.search);
        return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
}])

.directive('ngChromeControl', ['$window', function ($window) {

    return {
        restrict: 'E',
        link: function (scope, element, attrs) {
            element.attr("id", "chrome_ctrl_placeholder");
            //host url and title set automatically by SP
            var options = {
                appIconUrl: attrs.appiconurl,
                appTitle: attrs.apptitle,
            };
            if (attrs.apphelppageurl)
                options.appHelpPageUrl = attrs.apphelppageurl;

            var nav = new SP.UI.Controls.Navigation(element[0].id, options);
            nav.setVisible(true);

            scope.$watch
            (
                function () {
                    return attrs.apptitle;
                },
                function (newTitle, oldTitle) {
                    if (newTitle != oldTitle)
                        element.find('.ms-core-pageTitle').text(newTitle);
                }
            );
        }
    };

}])
.directive('ngPeoplePicker', [function () {
    return {
        restrict: 'A',
        require: "ngModel",
        link: link
    }

    function link(scope, element, attrs, ngModel) {

        var elementId = attrs.id;

        var returnUsername = (attrs.ngPeoplePicker == "username");

        var schema = {
            SearchPrincipalSource: 15,
            ResolvePrincipalSource: 15,
            MaximumEntitySuggestions: 50,
            Width: "100%",
            OnUserResolvedClientScript: onUserResolve
        };

        schema.Required = true;

        schema.PrincipalAccountType = "User,DL";

        if (attrs.allowmultiple) {
            schema.AllowMultipleValues = true;
        }
        else {
            schema.AllowMultipleValues = false;
        }

        SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function () {
            SPClientPeoplePicker_InitStandaloneControlWrapper(elementId, null, schema);
        });

        function onUserResolve() {
            var peoplePickerDictKey = elementId + "_TopSpan";
            var peoplePicker = SPClientPeoplePicker.SPClientPeoplePickerDict[peoplePickerDictKey];
            var people = peoplePicker.GetAllUserInfo();
            var returnValues = [];
            if (returnUsername) {
                angular.forEach(people, function (person) {
                    returnValues.push(person.AutoFillKey);
                });
            }
            else {
                angular.forEach(people, function (person) {
                    returnValues.push(person.EntityData.Email);
                });
            }
            if (schema.AllowMultipleValues) {
                ngModel.$setViewValue(returnValues);
            }
            else if (returnValues.length > 0) {
                ngModel.$setViewValue(returnValues[0]);
            }
        }
    }
}]);