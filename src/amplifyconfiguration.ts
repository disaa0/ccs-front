export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      identityPoolId: process.env.NEXT_PUBLIC_IDENTITY_POOL_ID!,
      signUpVerificationMethod: 'code' as 'code' | 'link' | undefined,
      loginWith: {
        email: true,
        username: true,
      },
    },
  },
  API: {
    REST: {
      FileAPI: {
        endpoint: process.env.NEXT_PUBLIC_API_ENDPOINT!,
        region: process.env.NEXT_PUBLIC_AWS_REGION!,
      },
    },
  },
  Storage: {
    S3: {
      bucket: process.env.NEXT_PUBLIC_S3_BUCKET!,
      region: process.env.NEXT_PUBLIC_AWS_REGION!,
    },
  },
};
