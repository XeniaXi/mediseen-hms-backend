/**
 * Helper to safely get a single string value from Express query parameters
 */
export const getQueryParam = (param: string | string[] | undefined): string | undefined => {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param;
};

/**
 * Helper to get a query param with a default value
 */
export const getQueryParamWithDefault = (
  param: string | string[] | undefined,
  defaultValue: string
): string => {
  const value = getQueryParam(param);
  return value || defaultValue;
};
