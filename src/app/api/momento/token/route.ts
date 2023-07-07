import {
    AllDataReadWrite,
    AuthClient,
    CredentialProvider,
    ExpiresIn,
    GenerateAuthToken,
} from "@gomomento/sdk";

const authClient = new AuthClient({
    credentialProvider: CredentialProvider.fromString({
        authToken: process.env.MOMENTO_AUTH_TOKEN,
    }),
})

export async function GET(request: Request) {
    const generateAuthTokenResponse = await authClient.generateAuthToken(AllDataReadWrite, ExpiresIn.seconds(5));

    if (generateAuthTokenResponse instanceof GenerateAuthToken.Success) {
        return new Response(generateAuthTokenResponse.authToken);
    } else if (generateAuthTokenResponse instanceof  GenerateAuthToken.Error) {
        throw new Error(generateAuthTokenResponse.message())
    }
    throw new Error("Unable to get token from momento")
}
