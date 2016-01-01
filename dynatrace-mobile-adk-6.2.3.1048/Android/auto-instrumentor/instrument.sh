#!/bin/bash

APK_FILE=
APK_INSTR_PROP_FILE=

function showUsage()
{
	echo "Usage: $0 apk=apk-file prop=instr-property-file"
}

function showMissingJSDK()
{
	echo "1 - Unable to find java or jar in ${JAVA_HOME}/bin. Ensure JSDK 1.7 or higher is installed and JAVA_HOME is set correctly."
    echo "2 - Or, the input APK file is invalid."
}

function setPaths()
{
	if [ `uname` == "Darwin" ]; then
		JAVA_HOME=`/usr/libexec/java_home`
		TOOLS_HOME=${INSTALL_FOLDER}/tools/MacOS
		APK_NAME_NO_EXT=`basename -s'.apk' "$APK_FILE"`
		/bin/rm -f "${HOME}/Library/apktool/framework/1.apk"
	else
		TOOLS_HOME=${INSTALL_FOLDER}/tools/linux
		export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${INSTALL_FOLDER}/tools/linux
		APK_NAME_NO_EXT=`basename "$APK_FILE" .apk`
		/bin/rm -f "${HOME}/apktool/framework/1.apk"
	fi	
}

while [ "$1" != "" ]; do
    PARAM=`echo "$1" | awk -F= '{print $1}'`
    VALUE=`echo "$1" | awk -F= '{print $2}' | sed -e 's/^"//'  -e 's/"$//'`
	case $PARAM in
		-h | --help)
			showUsage
			exit 0
			;;
		apk)
			APK_FILE="$VALUE"
			;;
		prop)
			APK_INSTR_PROP_FILE="$VALUE"
			;;
		*)
			echo "ERROR: unknown parameter \"$PARAM\""
			showUsage
			exit 1
			;;
	esac
	shift
done

if [ "${APK_FILE}" == "" ]; then
	showUsage
	exit 1
fi

if [ "${APK_INSTR_PROP_FILE}" == "" ]; then
	showUsage
	exit 1
fi

#-----------------------------------------------------------------------------------------
# set the paths for JAVA_HOME and the SDK tools depending on if we are Mac or Linux

INSTALL_FOLDER=`echo $(cd "$(dirname "$0")" && pwd -P)`
setPaths

#-----------------------------------------------------------------------------------------
# User may need to define JAVA_HOME environment variable

"${JAVA_HOME}/bin/jar" -tf "${APK_FILE}" > /dev/null

if [ "$?" != "0" ] ; then
	showMissingJSDK
	exit 1
fi

#-----------------------------------------------------------------------------------------
# Optionally user can define JVM options such as -Xmx

JAVA_OPTIONS=-Xmx1024m

#-----------------------------------------------------------------------------------------
# Define the runtime environment based on our installation - keying off the path of this script

LIB_FOLDER=${INSTALL_FOLDER}/libs
ASMDEX_LIB=${LIB_FOLDER}/asmdex.jar
DDX_LIB=${LIB_FOLDER}/ddx1.26.jar
APKTOOL_LIB=${LIB_FOLDER}/apktool.jar
DEX_LIB=${LIB_FOLDER}/dx.jar
DEX2JAR_HOME=${INSTALL_FOLDER}/dex2jar-0.0.9.13
ADK_LIB=${LIB_FOLDER}/DynatraceUEM.jar
ADK_CB_LIB=${LIB_FOLDER}/Callbacks.jar

# This variable points to a COMMA delimited list of libraries the instrumented code will need at runtime.
# These libraries are converted to Dex files and then merged into a given classes.dex/APK

DEPENDENT_LIBS=${ADK_CB_LIB},${ADK_LIB}

# Ensure Android SDK (aapt/zipalign/etc.) and Dex2Jar tools are on our path

PATH=${TOOLS_HOME}:${DEX2JAR_HOME}:${PATH}
export PATH

# Auto Instrumentation (dexify and merge) sub-processes need this environment variable to point to apktool.jar and dx.jar
# LIB_FOLDER is needed to find the overriding Android resource table, 1.apk 

TOOL_PATHS=${APKTOOL_LIB}:${DEX_LIB}
export TOOL_PATHS LIB_FOLDER

# Auto Instrumentation dependent libs/paths

RUNTIME_LIBS=${LIB_FOLDER}/Common.jar:${LIB_FOLDER}/CommonJava.jar:${LIB_FOLDER}/APKit.jar
CLASSPATH=${ASMDEX_LIB}:${DDX_LIB}:${DEX_LIB}:${RUNTIME_LIBS}
# Ensure execution permissions

chmod +x "${DEX2JAR_HOME}"/*.sh
chmod +x "${TOOLS_HOME}"/*

#-----------------------------------------------------------------------------------------
# Instrument the given APK

"${JAVA_HOME}/bin/java" ${JAVA_OPTIONS} -cp "${CLASSPATH}" com.cpwr.apm.android.adk.AdkInstrumentor "${APK_FILE}" -dep "${DEPENDENT_LIBS}" -prop "${APK_INSTR_PROP_FILE}"

if [ "${?}" != "0" ]; then
	echo Instrumentation failed
	exit 5
fi

#-----------------------------------------------------------------------------------------
# When the instrumentation is done, the result files are in these folders

APK_DIR=`dirname "$APK_FILE"`
APK_NAME=`basename "$APK_FILE"`
APK_WORK_DIR="${APK_DIR}/${APK_NAME_NO_EXT}"

INSTRUMENTED_APK="${APK_WORK_DIR}/dist/${APK_NAME}"
SIGNED_APK="${APK_WORK_DIR}/dist/${APK_NAME_NO_EXT}-signed.apk"
FINAL_APK="${APK_WORK_DIR}/dist/${APK_NAME_NO_EXT}-final.apk"

#-----------------------------------------------------------------------------------------

if [ -f "${INSTRUMENTED_APK}" ]; then
	echo Instrumentation completed - Instrumented APK: "${INSTRUMENTED_APK}"
else
	echo Instrumentation failed
	exit 2
fi

#-----------------------------------------------------------------------------------------
# Sign the instrumented APK

echo Signing non-release APK ...
d2j-apk-sign.sh -f -o "${SIGNED_APK}" "${INSTRUMENTED_APK}"

#-----------------------------------------------------------------------------------------

if [ -f "${SIGNED_APK}" ]; then
	echo Signing completed - Instrumented and signed APK: "${SIGNED_APK}"
else
	echo Signing failed
	exit 3
fi

#-----------------------------------------------------------------------------------------
# Zipalign the signed APK

zipalign -f 4 "${SIGNED_APK}" "${FINAL_APK}"

#-----------------------------------------------------------------------------------------

if [ -f "${FINAL_APK}" ]; then
	echo Zipaligning completed - Instrumented, signed and zipaligned APK: ${FINAL_APK}
else
	echo Zipaligning failed
	exit 4
fi

echo -----------------------------------------------------------------------------------------
echo Resulting APK files----------------------------------------------------------------------
echo Original: ${APK_FILE}
echo Instrumented: ${INSTRUMENTED_APK}
echo Instrumented and signed: ${SIGNED_APK}
echo Instrumented, signed and zipaligned: ${FINAL_APK}
echo -----------------------------------------------------------------------------------------
echo -----------------------------------------------------------------------------------------

exit 0

