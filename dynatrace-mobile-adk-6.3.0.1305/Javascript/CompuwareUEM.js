// 
//  CompuwareUEM.js
//  Version: 6.3.0.1305
//
//
// These materials contain confidential information and
// trade secrets of Compuware Corporation. You shall
// maintain the materials as confidential and shall not
// disclose its contents to any third party except as may
// be required by law or regulation. Use, disclosure,
// or reproduction is prohibited without the prior express
// written permission of Compuware Corporation.
//
// All Compuware products listed within the materials are
// trademarks of Compuware Corporation. All other company
// or product names are trademarks of their respective owners.
//
// Copyright (c) 2012-2013 Compuware Corporation. All rights reserved.
//
//

// Create a debug namespace for public functions
var ADKDebug = (function() {
                   
    // Private variables for this namespace
    var DEBUG = 0;          // Debugging is off by default

    // Public functions for this namespace
    // These functions should be called by the
    // Users app to set JS/Native bridge debugging on/off
    return {
        debugOn: function()
        {
            DEBUG = 1;
        },

        debugOff: function()
        {
            DEBUG = 0;
        },

        getDebug: function()
        {
            return DEBUG;
        }
    };
})();

// Create a namespace for our ADK JS Bridge internal functions
var ADKJSBridge = (function() {

    // Private variables for this namespace
    var iOSStatusRc = 0;    // iOS ADK status return code
    var iOSMsgQueue = [];   // An array to hold request messages for iOS

    // Public functions for this namespace
    return {
        // These functions are to be used by the ADK only
        iOSMsgQueueLength: function()
        {
            return iOSMsgQueue.length;
        },

        firstiOSMsgQueueItem: function(index)
        {
            var len = iOSMsgQueue.length - 1;
            var message = iOSMsgQueue[len];
            iOSMsgQueue.splice(len, 1);
            return message;
        },
                
        spliceiOSMsgQueue: function(key, msg)
        {
            iOSMsgQueue.splice(0, 0, key + "##" + msg);
        },

        setiOSStatusRc: function(str)
        {
            // Set the iOSStatusRc global variable
            // Called from the iOS Native UEM ADK
            
            iOSStatusRc = str;
        },
                   
        getiOSStatusRc: function(str)
        {
            // Set the iOSStatusRc global variable
            // Called from the iOS Native UEM ADK

            return iOSStatusRc;
        }
    };
})();

// This is the main JS/Native bridge object.
// Users should call the public functions from
// their native application's JS code
function CompuwareUEM()
{
    // Private variables
    var deviceType = null;	// Android, iOS, etc.
    var iOSActionId = 0;    // iOS ADK action Id

    // Private functions
    function setDeviceType()
    {
        // Determines the type of device being used.
        // Android and iOS are the only two types supported now.
        
        if (deviceType == null)
        {
        	try
        	{
        		if (navigator.userAgent.toLowerCase().indexOf("android") > -1)
        		{
        			deviceType = "android";
        		}
        		else
        		{
        			deviceType = "iOS";
        		}
        	}
        	catch(e)
        	{
        		errorMsg(e);
        	}
        }

		// The navigator does not exist ... try again specifically when running with Kony based application

		if (deviceType == null)
		{
			try
			{
				deviceType = kony.string.trim("" + kony.os.deviceInfo().name);	// returns "android" if Android
			}
			catch(e)
			{
				errorMsg(e);
			}
		}

        return deviceType;
    }
    
    function isAndroid()
    {
        // Determines if the device type is Android
        
        if (deviceType == null)
        {
            setDeviceType();
        }
        
        if (deviceType == "android")
        {
            return true;
        }
        else
        {
            return false;
        }
    }
    
    function errorMsg(e)
    {
        if(ADKDebug.getDebug())
        {
            alert(e);
        }
        else
        {
            console.log(e);
        }
    }
    
    function checkRC(funcName, rc)
    {
        // If the return code is an error (i.e. less than 2), throw an exception
        if(rc < 2)
        {
            throw("UEMADK Error in JS function: " + funcName + ", return code = " + rc);
        }
    }
    
    function CpwrUemiOSADK(_key, _msg)
    {
        // This function creates a dummy iFrame and then removes it.
        // It will cause the iOS Objective-C shouldStartLoadWithRequest webView
        // delegate method to fire, passing the Value from the js setAttribute function
        // through the NSURLRequest parameter. We intercept the request parameter and
        // then cancel the shouldStartLoadWithRequest method so as not to fully execute it.
        //
        // We could also do this via the js function: window.location = "uem:" + _key + ":##CpwrUemiOSADK##" + _msg"
        // But it has some nasty side effects such as:
        // - All setInterval and setTimeout calls immediatly stop on location change
        // - Every innerHTML won't work after a canceled location change
        // - If sequential window.location calls are made quickly, there may be a timing problem (iFrames are asynchronous)
        
        ADKJSBridge.setiOSStatusRc(0);
        
        // To prevent losing messages, add it to an array and have Objective-C retrieve them
        ADKJSBridge.spliceiOSMsgQueue(_key, _msg);
        
        var iframe = document.createElement("IFRAME");
        
        iframe.setAttribute("src", "uem:##CpwrUemiOSADK##");
        document.documentElement.appendChild(iframe);
        iframe.parentNode.removeChild(iframe);
        iframe = null;
        
        // Pass back the return code from the native side
        var rc = ADKJSBridge.getiOSStatusRc();
        return rc;
    }

    // Public functions that can be called by a native app's JS code
    CompuwareUEM.prototype.flushEvents = function()
    {
        // Send all collected events immediately from Javascript.
        
        // To reduce network traffic/usage the collected events are usually sent in packages where the oldest
        // event has an age of up to 9 minutes. Using this method you can force sending of all collected
        // events regardless of their age.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                CpwrUemAndroidADK.flushEvents();
                rc = 2;
            }
            else
            {
                rc = CpwrUemiOSADK("flushEvents", "");
            }
            checkRC("flushEvents", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportErrorInteger = function(errorName, errorValue)
    {
        // Sends a error to dynaTrace with an error value from Javascript.
        
        // Because this is a class method, the error is not associated with an action.  It creates
        // its own mobile-only PurePath.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.reportErrorInteger(errorName, errorValue);
            }
            else
            {
                rc = CpwrUemiOSADK("reportErrorWithNameErrorClass", errorName + "," + errorValue);
            }
            checkRC("reportErrorInteger",  rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportErrorString = function(errorName, exceptionValue)
    {
        // Sends a error to dynaTrace with an exception string value from Javascript.
        
        // Because this is a class method, the error is not associated with an action.  It creates
        // its own mobile-only PurePath.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = -3;	// not supported
            }
            else
            {
                rc = CpwrUemiOSADK("reportErrorWithNameExceptionClass", errorName + "," + exceptionValue);
            }
            checkRC("reportErrorString", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.enterAction = function(actionName)
    {
        // Starts a top level action from Javascript. And returns an Id for the action object.
        
        // The top level action results in a new mobile action PurePath in dynaTrace. An action allows you
        // to time an interval in your code.  Call enterAction: at the point you want to start timing.
        // Call the leaveAction instance method on the returned object at the point you want to stop timing.
        
        var actionId = 0;
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                actionId = CpwrUemAndroidADK.enterAction(actionName);
                rc = 2;
            }
            else
            {
                // Create the action Id in Javascript for iOS since the iFrame method can
                // lose connections to the native code. This will store the action Id along
                // with the message in the iOSMsgQueue so that it can be retireved by the native side
                iOSActionId++;
                rc = CpwrUemiOSADK("enterActionWithName", actionName + "," + iOSActionId);
                if(rc < 2)
                {
                    iOSActionId--;
                    actionId = 0;
                }
                else
                {
                    actionId = iOSActionId;
                }
            }
            checkRC("enterAction", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return actionId;
        }
    }

    CompuwareUEM.prototype.enterActionParentId = function(actionName, parentId)
    {
        // Starts an action from Javascript that is a child of the parent action, and returns
        // an Id for the action object.
        
        // The action adds a node to an existing mobile action PurePath in dynaTrace. An action allows you
        // to time an interval in your code.  Call enterActionIdParentId: at the point you want to
        // start timing.  Call the leaveAction instance method on the returned object at the point you want
        // to stop timing.
        
        var actionId = 0;
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                actionId = CpwrUemAndroidADK.enterAction(actionName, parentId);
                rc = 2;
            }
            else
            {
                // Create the action Id in Javascript for iOS since the iFrame method can
                // lose connections to the native code. This will store the action Id along
                // with the message in the iOSMsgQueue so that it can be retireved by the native side
                iOSActionId++;
                rc = CpwrUemiOSADK("enterActionWithNameParentId", actionName + "," + parentId + "," + iOSActionId);
                if(rc < 2)
                {
                    iOSActionId--;
                    actionId = 0;
                }
                else
                {
                    actionId = iOSActionId;
                }
            }
            checkRC("enterActionParentId", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return actionId;
        }
    }

    CompuwareUEM.prototype.leaveAction = function(actionId)
    {
        // Ends an action and computes its interval from Javascript.
        
        // All reported events, values, and tagged web requests between start and end of an action are
        // nested in the mobile action PurePath. If this action has any child actions, they are ended
        // first. Call this method at the end of the code that you wish to time. The number of milliseconds
        // since the action began is stored as the interval.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.leaveAction(actionId);
            }
            else
            {
                rc = CpwrUemiOSADK("leaveActionWithId", actionId);
            }
            checkRC("leaveAction", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportEvent = function(eventName, actionId)
    {
        // Sends an event to dynaTrace from Javascript.
        
        // The error becomes a node of the mobile action PurePath.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.reportEvent(eventName, actionId);
            }
            else
            {
                rc = CpwrUemiOSADK("reportEventWithName", eventName + "," + actionId);
            }
            checkRC("reportEvent", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportErrorIntegerWithAction = function(errorName, errorValue, actionId)
    {
        // Sends an error to dynaTrace with an error value from Javascript.
        
        // The error becomes a node of the mobile action PurePath.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.reportErrorInteger(errorName, errorValue, actionId);
            }
            else
            {
                rc = CpwrUemiOSADK("reportErrorWithNameError", errorName + "," + errorValue + "," + actionId);
            }
            checkRC("reportErrorIntegerWithAction", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportErrorStringWithAction = function(errorName, exceptionValue, actionId)
    {
        // Sends an error to dynaTrace with an exception string value from Javascript.
        
        // The error becomes a node of the mobile action PurePath.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = -3;	// not supported
            }
            else
            {
                rc = CpwrUemiOSADK("reportErrorWithNameException", errorName + "," + exceptionValue + "," + actionId);
            }
            checkRC("reportErrorStringWithAction", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportValueInt = function(valueName, intValue, actionId)
    {
        // Sends a key/value pair to dynaTrace from Javascript.
        
        // The value becomes a node of the mobile action PurePath. The value can be processed by a measure and
        // thus be charted.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.reportValueInteger(valueName, intValue, actionId);
            }
            else
            {
                rc = CpwrUemiOSADK("reportValueWithNameInt", valueName + "," + intValue + "," + actionId);
            }
            checkRC("reportValueInt", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportValueDouble = function(valueName, doubleValue, actionId)
    {
        // Sends a key/value pair to dynaTrace from Javascript.
        
        // The value becomes a node of the mobile action PurePath. The value can be processed by a measure and
        // thus be charted.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.reportValueDouble(valueName, doubleValue, actionId);
            }
            else
            {
                rc = CpwrUemiOSADK("reportValueWithNameDouble", valueName + "," + doubleValue + "," + actionId);
            }
            checkRC("reportValueDouble", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.reportValueString = function(valueName, stringValue, actionId)
    {
        // Sends a key/value pair to dynaTrace from Javascript.
        
        // The value becomes a node of the mobile action PurePath. The value can be processed by a measure and
        // thus be charted.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.reportValueString(valueName, stringValue, actionId);
            }
            else
            {
                rc = CpwrUemiOSADK("reportValueWithNameString", valueName + "," + stringValue + "," + actionId);
            }
            checkRC("reportValueString", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.setGpsLocation = function(longitude, latitude)
    {
        // Set the current GPS location of the user from Javascript.
        
        // The CompuwareUEM library does not automatically collect location information.  If the
        // developer wants location information to be transmitted to dynaTrace, then this function should
        // be used to provide it.
        
        var rc = -1;

        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.setGpsLocation(longitude, latitude);
            }
            else
            {
                rc = CpwrUemiOSADK("setGpsLocation", longitude + "," + latitude);
            }
            checkRC("setGpsLocation", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }


    CompuwareUEM.prototype.lastErrorCode = function()
    {
        // Provides information regarding internal errors for Javascript.
        
        // Use this to obtain the error code associated with the most recent CPWR_Error_InternalError or
        // enterAction. For the iOS ADK only
        
        var rc = -1;
        
        try
        {
            if (isAndroid())
            {
                rc = -3;  // Not implemented in Android ADK
            }
            else
            {
                rc = CpwrUemiOSADK("lastErrorCode", "");
            }
            checkRC("lastErrorCode", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }


    CompuwareUEM.prototype.lastErrorMsg = function()
    {
        // Provides a string describing internal errors for Javascript.
        
        // Use this to obtain the error message associated with most recent CPWR_Error_InternalError.
        // For the iOS ADK only
        
        var rc = -1;
        
        try
        {
            if (isAndroid())
            {
                rc = -3;  // Not implemented in Android ADK
            }
            else
            {
                rc = CpwrUemiOSADK("lastErrorMsg", "");
            }
            checkRC("lastErrorMsg", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.startTaggingRequests = function(actionId)
    {
        // Sends a cookie containing ADK information to the dT server
        // for the given action Id, from Javascript. In other words, start
        // grouping web requests under the given action until the action is closed

        var rc = -1;
        
        try
        {
            if (isAndroid())
            {
                rc = CpwrUemAndroidADK.setRequestCookieForAction(actionId);
            }
            else
            {
                rc = CpwrUemiOSADK("startTaggingRequestsForActionId", actionId);
            }
            checkRC("startTaggingRequests", rc);
        }
        catch(e)
        {
            errorMsg(e);
        }
        finally
        {
            return rc;
        }
    }

    CompuwareUEM.prototype.getCookieForAction = function(actionId)
    {
    	// get a cookie for the specific actionId
    	
    	var rc = 1;
    	
    	try
    	{
    		if (isAndroid())
    		{
    			rc = CpwrUemAndroidADK.getCookieForAction(actionId);
    		}
    		else 
    		{
    			rc = CpwrUemiOSADK.getCookieForAction("TODO");
    		}
    		checkRC("getCookieForAction", rc);
    	}
    	catch (e)
    	{
    		errorMsg(e);
    	}
    	finally
    	{
    		return rc;
    	}
    }

    CompuwareUEM.prototype.tagXmlHttpRequest = function(xmlHttpReq, actionId)
    {
        // Tag an XMLHttpRequest object. Action ID may be null, in which case,
        // an attempt to determine the appropriate action ID is made.

        var tag = null;

        try
        {
            if (isAndroid())
            {
                tag = CpwrUemAndroidADK.getRequestTag(actionId);
            }
            else
            {
                // not implemented
            }

            if (tag != null)
            {
                xmlHttpReq.setRequestHeader("X-dynaTrace", tag);
            }
            else
            {
                errorMsg(e);
            }
        }
        catch(e)
        {
            errorMsg(e);
        }
    }
    
}
