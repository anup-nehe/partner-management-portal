import { useState, useEffect, useRef } from "react";
import { useNavigate, useBlocker } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DropdownComponent from '../common/fields/DropdownComponent';
import { getUserProfile } from '../../services/UserProfileService';
import backArrow from '../../svg/back_arrow.svg';
import LoadingIcon from "../common/LoadingIcon";
import ErrorMessage from "../common/ErrorMessage";
import { getPartnerManagerUrl, handleServiceErrors, getPartnerTypeDescription, moveToOidcClientsList, isLangRTL, moveToApiKeysList, moveToHome, createRequest } from "../../utils/AppUtils";
import { HttpService } from '../../services/HttpService';
import DropdownWithSearchComponent from "../common/fields/DropdownWithSearchComponent";
import BlockerPrompt from "../common/BlockerPrompt";
import ApiKeyIdPopup from "./ApiKeyIdPopup";

function GenerateApiKey() {
    const { t } = useTranslation();
    const isLoginLanguageRTL = isLangRTL(getUserProfile().langCode);
    const [dataLoaded, setDataLoaded] = useState(true);
    const [errorCode, setErrorCode] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [partnerData, setPartnerData] = useState([]);
    const [showPopup, setShowPopup] = useState(false);
    const [partnerIdDropdownData, setPartnerIdDropdownData] = useState([]);
    const [policiesDropdownData, setPoliciesDropdownData] = useState([]);
    const [partnerId, setPartnerId] = useState("");
    const [policyName, setPolicyName] = useState("");
    const [partnerType, setPartnerType] = useState("");
    const [policyGroupName, setPolicyGroupName] = useState("");
    const [nameLabel, setNameLabel] = useState('');
    const [apiKeyId, setApiKeyId] = useState('');
    const [validationError, setValidationError] = useState("");
    const [nameValidationError, setNameValidationError] = useState("");
    const [isSubmitClicked, setIsSubmitClicked] = useState(false);
    const textareaRef = useRef(null);

    const navigate = useNavigate();

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => {
            if (isSubmitClicked) {
                setIsSubmitClicked(false);
                return false;
            }
            return (
                (partnerId !== "" || nameLabel !== "" || policyName !== "") && currentLocation.pathname !== nextLocation.pathname
            );
        }
    );

    useEffect(() => {
        const shouldWarnBeforeUnload = () => {
            return partnerId !== "" ||
                nameLabel !== "" ||
                policyName !== "";
        };

        const handleBeforeUnload = (event) => {
            if (shouldWarnBeforeUnload()) {
                event.preventDefault();
                event.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [partnerId, nameLabel, policyName]);

    const cancelErrorMsg = () => {
        setErrorMsg("");
        setShowPopup(false);
    };

    const onChangePartnerId = async (fieldName, selectedValue) => {
        setPartnerId(selectedValue);
        setPolicyName("");
        // Find the selected partner data
        const selectedPartner = partnerData.find(item => item.partnerId === selectedValue);
        if (selectedPartner) {
            setPartnerType(getPartnerTypeDescription(selectedPartner.partnerType, t));
            setPolicyGroupName(selectedPartner.policyGroupName);
            setPoliciesDropdownData(createPoliciesDropdownData('policyName', selectedPartner.activePolicies));
        }
    };

    const onChangePolicyName = (fieldName, selectedValue) => {
        setPolicyName(selectedValue);
    };

    const onChangeNameLabel = (value) => {
        const regexPattern = /^(?!\s+$)[a-zA-Z0-9-_ ,.&()]*$/;
        if (value.length > 36) {
            setNameValidationError(t('generateApiKey.nameTooLong'))
        } else if (!regexPattern.test(value)) {
            setNameValidationError(t('requestPolicy.specialCharNotAllowed'))
        } else {
            setNameValidationError("");
        }
        setNameLabel(value)
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                setDataLoaded(false);
                const response = await HttpService.get(getPartnerManagerUrl('/partners/getAllApprovedAuthPartnerPolicies', process.env.NODE_ENV));

                if (response && response.data) {
                    const responseData = response.data;

                    if (responseData.response) {
                        const resData = responseData.response;
                        setPartnerData(resData);
                        setPartnerIdDropdownData(createPartnerIdDropdownData('partnerId', resData));
                    } else {
                        handleServiceErrors(responseData, setErrorCode, setErrorMsg);
                    }
                } else {
                    setErrorMsg(t('createOidcClient.errorInResponse'));
                }
            } catch (err) {
                console.error('Error fetching data:', err);
            } finally {
                setDataLoaded(true);
            }
        };

        fetchData();
    }, [t]);

    const createPartnerIdDropdownData = (fieldName, dataList) => {
        let dataArr = [];
        dataList.forEach(item => {
            let alreadyAdded = false;
            dataArr.forEach(item1 => {
                if (item1.fieldValue === item[fieldName]) {
                    alreadyAdded = true;
                }
            });
            if (!alreadyAdded) {
                dataArr.push({
                    fieldCode: item[fieldName],
                    fieldValue: item[fieldName]
                });
            }
        });
        return dataArr;
    }

    const createPoliciesDropdownData = (fieldName, dataList) => {
        let dataArr = [];
        dataList.forEach(item => {
            let alreadyAdded = false;
            dataArr.forEach(item1 => {
                if (item1.fieldValue === item[fieldName]) {
                    alreadyAdded = true;
                }
            });
            if (!alreadyAdded) {
                dataArr.push({
                    fieldCode: item[fieldName],
                    fieldValue: item[fieldName],
                    fieldDescription: item.policyDescription
                });
            }
        });
        return dataArr;
    };

    const styles = {
        outerDiv: "!ml-0 !mb-0",
        dropdownLabel: "!text-sm !mb-1",
        dropdownButton: "!w-full !h-10 !rounded-md !text-base !text-left",
        selectionBox: "!top-10"
    }

    const clearForm = () => {
        setPartnerId("");
        setPartnerType("");
        setPolicyGroupName("");
        setPolicyName("");
        setNameLabel("");
        setPoliciesDropdownData([]);
        setValidationError("");
        setNameValidationError("");
    };

    const isFormValid = () => {
        return partnerId && policyName && nameLabel && !validationError && !nameValidationError;
    };

    const clickOnSubmit = async () => {
        setShowPopup(false);
        setIsSubmitClicked(true);
        setErrorCode("");
        setErrorMsg("");
        let request = createRequest({
            policyName: policyName,
            label: nameLabel
        });
        try {
            const response = await HttpService.patch(getPartnerManagerUrl(`/partners/${partnerId}/generate/apikey`, process.env.NODE_ENV), request, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response) {
                const responseData = response.data;
                if (responseData && responseData.response) {
                    const resData = responseData.response;
                    console.log(`Response data: ${resData.length}`);
                    setApiKeyId(responseData.response.apiKey);
                } else {
                    handleServiceErrors(responseData, setErrorCode, setErrorMsg);
                }
            } else {
                setErrorMsg(t('generateApiKey.errorInGenerateApiKey'));
            }
            setShowPopup(true);
            setDataLoaded(true);
        } catch (err) {
            setErrorMsg(err);
            console.log("Error fetching data: ", err);
        }
    }

    return (
        <div className={`mt-2 w-[100%] ${isLoginLanguageRTL ? "mr-28 ml-5" : "ml-28 mr-5"} overflow-x-scroll font-inter max-[450px]:text-xs`}>
            {!dataLoaded && (
                <LoadingIcon></LoadingIcon>
            )}
            {dataLoaded && (
                <>
                    {errorMsg && (
                        <div className={`flex justify-end max-w-7xl sm:max-w-xl mb-5 absolute ${isLoginLanguageRTL ? "left-0" : "right-2"}`}>
                            <div className="flex justify-between items-center max-w-[35rem] min-h-14 min-w-72 max-[450px]:min-w-40 max-[450px]:min-h-40 bg-[#C61818] rounded-xl p-3">
                                <ErrorMessage errorCode={errorCode} errorMessage={errorMsg} clickOnCancel={cancelErrorMsg}></ErrorMessage>
                            </div>
                        </div>
                    )}
                    <div className="flex-col mt-7">
                        <div className="flex justify-between">
                            <div className="flex items-start gap-x-3">
                                <img src={backArrow} alt="" onClick={() => moveToApiKeysList(navigate)} className={`mt-[5%] cursor-pointer ${isLoginLanguageRTL ? "rotate-180" : null}`} />
                                <div className="flex-col">
                                    <h1 className="font-semibold text-lg max-[450px]:text-md text-dark-blue">{t('generateApiKey.generateApiKey')}</h1>
                                    <div className="flex space-x-1 max-[450px]:flex-col">
                                        <p onClick={() => moveToHome(navigate)} className="font-semibold text-tory-blue text-xs cursor-pointer">
                                            {t('commons.home')} /
                                        </p>
                                        <p onClick={() => moveToApiKeysList(navigate)} className="font-semibold text-tory-blue text-xs cursor-pointer">
                                            {t('authenticationServices.authenticationServices')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="w-[100%] bg-snow-white mt-[1.5%] rounded-lg shadow-md">
                            <div className="px-[2.5%] py-[2%]">
                                <p className="text-base text-[#3D4468]">{t('requestPolicy.mandatoryFieldsMsg1')} <span className="text-crimson-red">*</span> {t('requestPolicy.mandatoryFieldsMsg2')}</p>
                                <form>
                                    <div className="flex flex-col">
                                        <div className="flex flex-row justify-between space-x-4 max-[450px]:space-x-0 my-[1%] max-[700px]:flex-col">
                                            <div className="flex-col w-[48%] max-[450px]:w-full">
                                                <DropdownComponent
                                                    fieldName='partnerId'
                                                    dropdownDataList={partnerIdDropdownData}
                                                    onDropDownChangeEvent={onChangePartnerId}
                                                    fieldNameKey='requestPolicy.partnerId*'
                                                    placeHolderKey='createOidcClient.selectPartnerId'
                                                    selectedDropdownValue={partnerId}
                                                    styleSet={styles}
                                                    addInfoIcon={true}
                                                    infoKey='createOidcClient.partnerIdTooltip'>
                                                </DropdownComponent>
                                            </div>
                                            <div className="flex-col w-[48%] max-[450px]:w-full">
                                                <label className={`block text-dark-blue text-sm font-semibold mb-1 ${isLoginLanguageRTL ? "mr-1" : "ml-1"}`}>{t('requestPolicy.partnerType')}<span className="text-crimson-red">*</span></label>
                                                <button disabled className="flex items-center justify-between w-full h-10 px-2 py-2 border border-[#C1C1C1] rounded-md text-base text-vulcan bg-platinum-gray leading-tight focus:outline-none focus:shadow-outline
                                                    overflow-x-auto whitespace-nowrap no-scrollbar" type="button">
                                                    <span>{partnerType || t("partnerTypes.authPartner")}</span>
                                                    <svg className={`w-3 h-2 ml-3 transform 'rotate-0' text-gray-500 text-base`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-row justify-between space-x-4 max-[450px]:space-x-0 my-2 max-[500px]:flex-col">
                                            <div className="flex flex-col w-[48%] max-[450px]:w-full">
                                                <label className={`block text-dark-blue text-sm font-semibold mb-1 ${isLoginLanguageRTL ? "mr-1" : "ml-1"}`}>{t('requestPolicy.policyGroup')}<span className="text-crimson-red">*</span></label>
                                                <button disabled className="flex items-center justify-between w-full h-10 px-2 py-2 border border-[#C1C1C1] rounded-md text-sm text-vulcan bg-platinum-gray leading-tight focus:outline-none focus:shadow-outline
                                                    overflow-x-auto whitespace-nowrap no-scrollbar" type="button">
                                                    <span>{policyGroupName || t('requestPolicy.policyGroup')}</span>
                                                    <svg className={`w-3 h-2 ml-3 transform 'rotate-0' text-gray-500 text-base`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="flex flex-col w-[48%] max-[450px]:w-full">
                                                <DropdownWithSearchComponent
                                                    fieldName='policyName'
                                                    dropdownDataList={policiesDropdownData}
                                                    onDropDownChangeEvent={onChangePolicyName}
                                                    fieldNameKey='requestPolicy.policyName*'
                                                    placeHolderKey='generateApiKey.selectedPolicyName'
                                                    selectedDropdownValue={policyName}
                                                    searchKey='commons.search'
                                                    styleSet={styles}
                                                    addInfoIcon={true}
                                                    disabled={!partnerId}
                                                    infoKey={t('createOidcClient.policyNameToolTip')} />
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="my-4">
                                                <div className="flex flex-col w-[48%] max-[450px]:w-full">
                                                    <label className={`block text-dark-blue text-sm font-semibold mb-1 ${isLoginLanguageRTL ? "mr-1" : "ml-1"}`}>{t('generateApiKey.name')}<span className="text-crimson-red">*</span></label>
                                                    <input value={nameLabel} onChange={(e) => onChangeNameLabel(e.target.value)}
                                                        className="h-10 px-2 py-3 border border-[#707070] rounded-md text-md text-dark-blue dark:placeholder-gray-400 bg-white leading-tight focus:outline-none focus:shadow-outline overflow-x-auto whitespace-nowrap no-scrollbar"
                                                        placeholder={t('generateApiKey.enterNameForApiKey')} />
                                                    {nameValidationError && <span className="text-sm text-crimson-red font-medium">{nameValidationError}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="border bg-medium-gray" />
                            <div className="flex flex-row max-[450px]:flex-col px-[3%] py-5 justify-between max-[450px]:space-y-2">
                                <button onClick={() => clearForm()} className={`w-40 h-10 mr-3 border-[#1447B2] ${isLoginLanguageRTL ? "mr-2" : "ml-2"} border rounded-md bg-white text-tory-blue text-sm font-semibold`}>{t('requestPolicy.clearForm')}</button>
                                <div className={`flex flex-row max-[450px]:flex-col space-x-3 max-[450px]:space-x-0 max-[450px]:space-y-2 w-full md:w-auto justify-end`}>
                                    <button onClick={() => moveToApiKeysList(navigate)} className={`${isLoginLanguageRTL ? "ml-2" : "mr-2"} w-11/12 md:w-40 h-10 border-[#1447B2] border rounded-md bg-white text-tory-blue text-sm font-semibold`}>{t('requestPolicy.cancel')}</button>
                                    <button disabled={!isFormValid()} onClick={() => clickOnSubmit()} className={`${isLoginLanguageRTL ? "ml-2" : "mr-2"} w-11/12 md:w-40 h-10 border-[#1447B2] border rounded-md text-sm font-semibold ${isFormValid() ? 'bg-tory-blue text-white' : 'border-[#A5A5A5] bg-[#A5A5A5] text-white cursor-not-allowed'}`}>{t('requestPolicy.submit')}</button>
                                    {(showPopup && !errorMsg) && (
                                        <ApiKeyIdPopup closePopUp={setShowPopup} partnerId={partnerId} policyName={policyName} apiKeyId={apiKeyId}/>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            <BlockerPrompt blocker={blocker} />
        </div>
    )
}

export default GenerateApiKey;