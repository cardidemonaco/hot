@echo off

setlocal

set APK_FILE=
set APK_INSTR_PROP_FILE=
set INSTALL_FOLDER=%~dp0
set ANDROID_SDK_HOME=%~dp0\tools\win

:parseargs
if not "%1"=="" (
	if "%1"=="apk" (
		SET APK_FILE=%~2
		SHIFT
	)
	if "%1"=="prop" (
		SET APK_INSTR_PROP_FILE=%~2
		SHIFT
	)
	SHIFT
	goto :parseargs
)

del /F /Q "%HOMEDRIVE%%HOMEPATH%\apktool\framework\1.apk"
del /F /Q "%cd:~0,2%\%USERNAME%\apktool\framework\1.apk"

:: Optionally, user can define JVM options such as -Xmx

set JAVA_OPTIONS=-Xmx512m

:: -----------------------------------------------------------------------------------------
:: Do java and jar exist and can we execute them?
:: -----------------------------------------------------------------------------------------

"%JAVA_HOME%\bin\java" -version 1> NUL 2> NUL
if not %errorLevel%==0 goto :java_not_found

"%JAVA_HOME%\bin\jar" -tf "%APK_FILE%" 1> NUL 2> NUL
if not %errorLevel%==0 goto :java_not_found

:: -----------------------------------------------------------------------------------------
:: Define the runtime environment based on our installation - keying off the path of this script
:: -----------------------------------------------------------------------------------------

set LIB_FOLDER=%INSTALL_FOLDER%\libs
set ASMDEX_LIB=%LIB_FOLDER%\asmdex.jar
set DDX_LIB=%LIB_FOLDER%\ddx1.26.jar
set APKTOOL_LIB=%LIB_FOLDER%\apktool.jar
set DEX_LIB=%LIB_FOLDER%\dx.jar
set DEX2JAR_HOME=%INSTALL_FOLDER%\dex2jar-0.0.9.13
set ADK_LIB=%LIB_FOLDER%\DynatraceUEM.jar
set ADK_CB_LIB=%LIB_FOLDER%\Callbacks.jar

:: -----------------------------------------------------------------------------------------
:: This variable points to a COMMA delimited list of libraries the instrumented code will need at runtime.
:: These libraries are converted to Dex files and then merged into a given classes.dex\APK 
:: -----------------------------------------------------------------------------------------

set DEPENDENT_LIBS=%ADK_CB_LIB%,%ADK_LIB%

:: -----------------------------------------------------------------------------------------
:: Ensure Android SDK (aapt) and Dex2Jar tools are on our path
:: -----------------------------------------------------------------------------------------

set PATH=%ANDROID_SDK_HOME%;%DEX2JAR_HOME%;%PATH%

:: -----------------------------------------------------------------------------------------
:: Auto Instrumentation (dexify and merge) sub-processes need this environment variable to point to apktool.jar and dx.jar
:: LIB_FOLDER is needed to find the overriding Android resource table, 1.apk
:: -----------------------------------------------------------------------------------------

set TOOL_PATHS=%APKTOOL_LIB%;%DEX_LIB%

:: -----------------------------------------------------------------------------------------
:: Auto Instrumentation dependent libs\paths
:: -----------------------------------------------------------------------------------------

set RUNTIME_LIBS=%LIB_FOLDER%\Common.jar;%LIB_FOLDER%\CommonJava.jar;%LIB_FOLDER%\APKit.jar

set CLASSPATH=%ASMDEX_LIB%;%DDX_LIB%;%DEX_LIB%;%RUNTIME_LIBS%

:: -----------------------------------------------------------------------------------------
:: Let's make sure we have everything we need
:: -----------------------------------------------------------------------------------------

if "%APK_FILE%"=="" GOTO :usage
if "%APK_INSTR_PROP_FILE%"=="" GOTO :usage
if not exist "%APK_FILE%" goto :apk_file_missing
if not exist "%APK_INSTR_PROP_FILE%" goto :prop_file_missing

:: -----------------------------------------------------------------------------------------
:: Instrument the given APK
:: -----------------------------------------------------------------------------------------

"%JAVA_HOME%\bin\java" %JAVA_OPTIONS% -cp "%CLASSPATH%" com.cpwr.apm.android.adk.AdkInstrumentor "%APK_FILE%" -dep "%DEPENDENT_LIBS%" -prop "%APK_INSTR_PROP_FILE%"

if %errorLevel% neq 0 goto :instrumentation_failed

:: -----------------------------------------------------------------------------------------
:: When the instrumentation is done, the result files are in these folders
:: -----------------------------------------------------------------------------------------

set FULLFILE=%APK_FILE%
for /F "tokens=*" %%i in ("%FULLFILE%") do set BASEFILE=%%~ni
set APK_DIR=%BASEFILE%
set APK_NAME_NO_EXT=%BASEFILE%
for /F "tokens=*" %%i in ("%FULLFILE%") do set BASEDIR=%%~dpi
set APK_WORK_DIR=%BASEDIR%\%APK_DIR%

set "INSTRUMENTED_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%.apk"
set "SIGNED_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%-signed.apk"
set "FINAL_APK=%APK_WORK_DIR%\dist\%APK_NAME_NO_EXT%-final.apk"

if not exist "%INSTRUMENTED_APK%" goto :instrumentation_failed

:: -----------------------------------------------------------------------------------------
:: Sign the instrumented APK
:: -----------------------------------------------------------------------------------------

echo Signing non-release APK ...
call d2j-apk-sign.bat -f -o "%SIGNED_APK%" "%INSTRUMENTED_APK%"

if not exist "%SIGNED_APK%" goto :apk_sign_failed

:: -----------------------------------------------------------------------------------------
:: Zipalign the signed APK
:: -----------------------------------------------------------------------------------------

zipalign -f 4 "%SIGNED_APK%" "%FINAL_APK%"

echo -----------------------------------------------------------------------------------------
echo Resulting APK files----------------------------------------------------------------------
echo Original: %APK_FILE%
echo Instrumented: %INSTRUMENTED_APK%
echo Instrumented and signed: %SIGNED_APK%
echo Instrumented, signed and zipaligned: %FINAL_APK%
echo -----------------------------------------------------------------------------------------
echo -----------------------------------------------------------------------------------------

:: -----------------------------------------------------------------------------------------
:: End of logic
:: -----------------------------------------------------------------------------------------
goto :end

:apk_file_missing
echo APK file %APK_FILE% not found.
goto :usage

:prop_file_missing
echo Properties file %APK_INSTR_PROP_FILE% not found.
goto :usage

:usage
echo Usage: instrument.cmd apk=apk-file prop=instr-property-file
goto :end

:java_not_found
echo 1 - Unable to find java or jar in %JAVA_HOME%\bin. Ensure JSDK 1.7 or higher is installed and JAVA_HOME is set correctly.
echo 2 - Or, the input APK file is invalid.
goto :end

:instrumentation_failed
echo Unable to instrument %APK_FILE%. See log for details.
goto :end

:end
endlocal
