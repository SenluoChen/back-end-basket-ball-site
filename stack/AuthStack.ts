import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StringAttribute, UserPool, UserPoolClient, UserPoolClientIdentityProvider } from "aws-cdk-lib/aws-cognito";

interface AuthStackProps extends cdk.StackProps {
  appName: string;
  deployEnv: string;
}

export class AuthStack extends cdk.Stack {
    public readonly userPool: UserPool;
    public readonly userPoolClient: UserPoolClient;

    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id, props);

        const appCodePath = "../../app";

        // 🧑‍⚕️ User pool
        this.userPool = new UserPool(this, `${props.deployEnv}-${props.appName}-user-pool`, {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            signInAliases: { email: true},
            autoVerify: {
                email: true
            },
            selfSignUpEnabled: true,
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
            },
            userVerification: {
                emailSubject: "Réinitialisation de votre mot de passe",
                emailBody: `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Réinitialisation de Mot de Passe - BasketDataCoach</title>
                            <style>
                                body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
                                .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; }
                                .header { color: #008577; text-align: center; }
                                .footer { font-size: 0.8em; text-align: center; color: #666; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1 class="header">Réinitialisation de votre mot de passe</h1>
                                <img src="https://image-accureate-demo.s3.eu-west-3.amazonaws.com/logo.png" alt="Logo" style="display: block; margin: 0 auto; width: 100px;">
                                <p>Bonjour,</p>
                                <p>Une demande de réinitialisation de votre mot de passe a été effectuée pour votre compte sur BasketDataCoach.</p>
                                <p>Voici votre code :</p>
                                <p style="text-align: center; font-weight: bold; font-size: 1.2em;">{####}</p>
                                <p>Entrez ce code sur le site pour créer un nouveau mot de passe.</p>
                                <p>Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email.</p>
                                <p>— L’équipe BasketDataCoach</p>
                                <hr>
                                <p class="footer">Cet email est automatique, merci de ne pas y répondre directement.</p>
                            </div>
                        </body>
                    </html>
                `,
            },
            userInvitation: {
                emailSubject: "Bienvenue sur BasketDataCoach",
                emailBody: `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Votre compte BasketDataCoach</title>
                            <style>
                                body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
                                .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; }
                                .header { color: #008577; text-align: center; }
                                .footer { font-size: 0.8em; text-align: center; color: #666; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h1 class="header">Bienvenue sur BasketDataCoach</h1>
                                <img src="https://image-accureate-demo.s3.eu-west-3.amazonaws.com/logo.png" alt="Logo" style="display: block; margin: 0 auto; width: 100px;">
                                <p>Bonjour,</p>
                                <p>Un compte a été créé pour vous sur la plateforme <strong>BasketDataCoach</strong>, dédiée à l’analyse de vos matchs de basket.</p>
                                <p>Vos identifiants temporaires sont :</p>
                                <p><strong>Nom d'utilisateur :</strong> {username}</p>
                                <p><strong>Mot de passe temporaire :</strong> {####}</p>
                                <p>Connectez-vous ici pour changer votre mot de passe :</p>
                                <p><a href="https://basketdatacoach.com/login">https://basketdatacoach.com/login</a></p>
                                <p>— L’équipe BasketDataCoach</p>
                                <hr>
                                <p class="footer">Si vous avez des questions, écrivez à : support@basketdatacoach.com</p>
                                <p>Si vous n’êtes pas à l’origine de cette inscription, ignorez simplement cet email.</p>
                            </div>
                        </body>
                    </html>
                `,
            }
        });
    
        this.userPool.addDomain(`${props.deployEnv}-${props.appName}-user-domain`, {
            cognitoDomain: {
                domainPrefix: `${props.deployEnv}-${props.appName}-user`
            }
        });

        this.userPool.addClient(`${props.deployEnv}-${props.appName}-user-client`, {
            generateSecret: false,
            authFlows: {
                adminUserPassword: true,
                userPassword: true,
                userSrp: true,
                custom: true,
            },
            oAuth: {
                callbackUrls: ["https://www.google.com/"],
                flows: {authorizationCodeGrant:true}
            },
            preventUserExistenceErrors: true,
            supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO]
        });

    }
}