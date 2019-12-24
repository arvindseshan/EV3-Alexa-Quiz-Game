/* eslint-disable  func-names */
/* eslint-disable  no-console */
/* eslint-disable  no-restricted-syntax */

// IMPORTANT: Please note that this template uses Dispay Directives,
// Display Interface for your skill should be enabled through the Amazon developer console
// See this screenshot - https://alexa.design/enabledisplay

const Alexa = require('ask-sdk-core');
const Util = require('./util');
const Common = require('./common');

// The audio tag to include background music
const BG_MUSIC = '<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_waiting_loop_30s_01"/>';

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';

/* INTENT HANDLERS */
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === `LaunchRequest`;
  },
  handle: async function(handlerInput) {

    const request = handlerInput.requestEnvelope;
    const { apiEndpoint, apiAccessToken } = request.context.System;
    const apiResponse = await Util.getConnectedEndpoints(apiEndpoint, apiAccessToken);
    if ((apiResponse.endpoints || []).length === 0) {
        return handlerInput.responseBuilder
        .speak(`I couldn't find an EV3 Brick connected to this Echo device. Please check to make sure your EV3 Brick is connected, and try again.`)
        .getResponse();
    }

    // Store the gadget endpointId to be used in this skill session
    const endpointId = apiResponse.endpoints[0].endpointId || [];
    Util.putSessionAttribute(handlerInput, 'endpointId', endpointId);
  
    // Set skill duration to 5 minutes (ten 30-seconds interval)
    Util.putSessionAttribute(handlerInput, 'duration', 30);

    // Set the token to track the event handler
    const token = handlerInput.requestEnvelope.request.requestId;
    Util.putSessionAttribute(handlerInput, 'token', token);  

      
      
    return handlerInput.responseBuilder
      .speak(welcomeMessage + BG_MUSIC)
      .reprompt(helpMessage)
      .addDirective(Util.buildStartEventHandler(token,60000, {}))
      .getResponse();
  },
};

const QuizHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    console.log("Inside QuizHandler");
    console.log(JSON.stringify(request));
    return request.type === "IntentRequest" &&
           (request.intent.name === "QuizIntent" || request.intent.name === "AMAZON.StartOverIntent");
  },
  handle(handlerInput) {
    console.log("Inside QuizHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;
    
    let endpointId = attributes.endpointId || [];
    let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
    {
        type: 'ask',
    });

    attributes.country = countries.QUIZ;
    attributes.counter = 0;
    attributes.quizScore = [0, 0, 0, 0, 0];
    attributes.activePlayer = 1
    attributes.buzzed = false;

    var question = askQuestion(handlerInput);
    var speakOutput = startQuizMessage + question;
    var repromptOutput = question;

    const item = attributes.quizItem;
    const property = attributes.quizProperty;

    if (supportsDisplay(handlerInput)) {
      const title = `Question #${attributes.counter}`;
      const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getQuestionWithoutOrdinal(property, item)).getTextContent();
      const backgroundImage = new Alexa.ImageHelper().addImageInstance(getBackgroundImage(attributes.quizItem.Abbreviation)).getImage();
      const itemList = [];
      getAndShuffleMultipleChoiceAnswers(attributes.selectedItemIndex, item, property).forEach((x, i) => {
        itemList.push(
          {
            "token" : x,
            "textContent" : new Alexa.PlainTextContentHelper().withPrimaryText(x).getTextContent(),
          }
        );
      });
      response.addRenderTemplateDirective({
        type : 'ListTemplate1',
        token : 'Question',
        backButton : 'hidden',
        backgroundImage,
        title,
        listItems : itemList,
      });
    }

    return response.speak(speakOutput)
                  .addDirective(directive)
                   .reprompt(repromptOutput)
                   .getResponse();
  },
};


const QuizAnswerHandler = {
  canHandle(handlerInput) {
    console.log("Inside QuizAnswerHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return attributes.country === countries.QUIZ &&
           request.type === 'IntentRequest' &&
           request.intent.name === 'AnswerIntent';
  },
  handle(handlerInput) {
    var speakOutput = ``;

    console.log("Inside QuizAnswerHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const response = handlerInput.responseBuilder;
    if (attributes.buzzed === false) {
        console.log("early answer ignored");
        speakOutput = "You must click your buzzer before answering"
        return response.speak(speakOutput)
              .reprompt(repromptOutput)
    }

    var repromptOutput = ``;
    const item = attributes.quizItem;
    const property = attributes.quizProperty;
    const isCorrect = compareSlots(handlerInput.requestEnvelope.request.intent.slots, item[property]);
    console.log(handlerInput.requestEnvelope.request.intent.slots)
    console.log(item[property])
    
    if (isCorrect) {
      speakOutput = "Good Job Player " + attributes.activePlayer + ".";
      // + getSpeechCon(true);
      attributes.quizScore[attributes.activePlayer] += 1;
      handlerInput.attributesManager.setSessionAttributes(attributes);
    } else {
      speakOutput = "Wrong, player " + attributes.activePlayer + ".";
      // + getSpeechCon(false);
    }
    attributes.buzzed = false

    speakOutput += getAnswer(property, item);
    var question = ``;
    //IF YOUR QUESTION COUNT IS LESS THAN 5, WE NEED TO ASK ANOTHER QUESTION.
    if (attributes.counter < 5) {
      let endpointId = attributes.endpointId || [];
      let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
      {
        type: 'ask',
      });

      speakOutput += getCurrentScore(attributes.quizScore, attributes.counter);
      question = askQuestion(handlerInput);
      speakOutput += question;
      repromptOutput = question;

      if (supportsDisplay(handlerInput)) {
        const title = `Question #${attributes.counter}`;
        const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getQuestionWithoutOrdinal(attributes.quizProperty, attributes.quizItem)).getTextContent();
        const backgroundImage = new Alexa.ImageHelper().addImageInstance(getBackgroundImage(attributes.quizItem.Abbreviation)).getImage();
        const itemList = [];
        getAndShuffleMultipleChoiceAnswers(attributes.selectedItemIndex, attributes.quizItem, attributes.quizProperty).forEach((x, i) => {
          itemList.push(
            {
              "token" : x,
              "textContent" : new Alexa.PlainTextContentHelper().withPrimaryText(x).getTextContent(),
            }
          );
        });
        response.addRenderTemplateDirective({
          type : 'ListTemplate1',
          token : 'Question',
          backButton : 'hidden',
          backgroundImage,
          title,
          listItems : itemList,
        });
      }
      
      return response.speak(speakOutput)
      .addDirective(directive)
      .reprompt(repromptOutput)
      .getResponse();
    }
    else {
      console.log("Inside QuizAnswerHandler - finishing game");

      speakOutput += getFinalScore(attributes.quizScore, attributes.counter) +  ' <break time="1s"/> ' + exitSkillMessage;
      console.log(speakOutput);
      if(supportsDisplay(handlerInput)) {
        const title = 'Thank you for playing';

        const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getFinalScore(attributes.quizScore, attributes.counter)).getTextContent();
        response.addRenderTemplateDirective({
          type : 'BodyTemplate1',
          backButton: 'hidden',
          title,
          textContent: primaryText,
        });

      }
      return response.speak(speakOutput).getResponse();
    }
  },
};

const RepeatHandler = {
  canHandle(handlerInput) {
    console.log("Inside RepeatHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return attributes.country === countries.QUIZ &&
           request.type === 'IntentRequest' &&
           request.intent.name === 'AMAZON.RepeatHandler';
  },
  handle(handlerInput) {
    console.log("Inside RepeatHandler - handle");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const question = getQuestion(attributes.counter, attributes.quizproperty, attributes.quizitem);

    return handlerInput.responseBuilder
      .speak(question)
      .reprompt(question)
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    console.log("Inside HelpHandler");
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
           request.intent.name === 'AMAZON.HelpHandler';
  },
  handle(handlerInput) {
    console.log("Inside HelpHandler - handle");
    return handlerInput.responseBuilder
      .speak(helpMessage)
      .reprompt(helpMessage)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    console.log("Inside ExitHandler");
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const request = handlerInput.requestEnvelope.request;

    return request.type === `IntentRequest` && (
              request.intent.name === 'AMAZON.StopIntent' ||
              request.intent.name === 'AMAZON.PauseIntent' ||
              request.intent.name === 'AMAZON.CancelIntent'
           );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(exitSkillMessage)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    console.log("Inside SessionEndedRequestHandler");
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    console.log("Inside ErrorHandler");
    return true;
  },
  handle(handlerInput, error) {
    console.log("Inside ErrorHandler - handle");
    console.log(`Error handled: ${JSON.stringify(error)}`);
    console.log(`Handler Input: ${JSON.stringify(handlerInput)}`);

    return handlerInput.responseBuilder
      .speak(helpMessage)
      .reprompt(helpMessage)
      .getResponse();
  },
};

const EventsReceivedRequestHandler = {
    // Checks for a valid token and endpoint.
    canHandle(handlerInput) {
        let { request } = handlerInput.requestEnvelope;
        console.log('Request type: ' + Alexa.getRequestType(handlerInput.requestEnvelope));
        if (request.type !== 'CustomInterfaceController.EventsReceived') return false;

        const attributesManager = handlerInput.attributesManager;
        let sessionAttributes = attributesManager.getSessionAttributes();
        let customEvent = request.events[0];

        // Validate event token
        if (sessionAttributes.token !== request.token) {
            console.log("Event token doesn't match. Ignoring this event");
            return false;
        }

        // Validate endpoint
        let requestEndpoint = customEvent.endpoint.endpointId;
        if (requestEndpoint !== sessionAttributes.endpointId) {
            console.log("Event endpoint id doesn't match. Ignoring this event");
            return false;
        }
        return true;
    },
    handle(handlerInput) {
        const attributes = handlerInput.attributesManager.getSessionAttributes();

        console.log("== Received Custom Event ==");
        let customEvent = handlerInput.requestEnvelope.request.events[0];
        let payload = customEvent.payload;
        let name = customEvent.header.name;

        let speechOutput;
        if (name === 'Answer') {
            let player = parseInt(payload.player);
            attributes.activePlayer = player
            attributes.buzzed = true
            let speechOutput = "Player " + payload.player + " buzzed first, what is your answer";
            return handlerInput.responseBuilder
                .speak(speechOutput, "REPLACE_ALL")
                .withShouldEndSession(false)
                .getResponse();
            
        } else {
            speechOutput = "Event not recognized. Awaiting new command.";
        }
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
            .getResponse();
    }
};


const ExpiredRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'CustomInterfaceController.Expired'
    },
    handle(handlerInput) {
        console.log("== Custom Event Expiration Input ==");

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        const attributesManager = handlerInput.attributesManager;
        let duration = attributesManager.getSessionAttributes().duration || 0;
        if (duration > 0) {
            Util.putSessionAttribute(handlerInput, 'duration', --duration);

            // Extends skill session
            const speechOutput = `${duration} minutes remaining.`;
            return handlerInput.responseBuilder
                .addDirective(Util.buildStartEventHandler(token, 60000, {}))
                // .speak(speechOutput + BG_MUSIC)
                .getResponse();
        }
        else {
            // End skill session
            return handlerInput.responseBuilder
                .speak("Skill duration expired. Goodbye.")
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};


/* CONSTANTS */
const skillBuilder = Alexa.SkillBuilders.custom();
const imagePath = "https://raw.githubusercontent.com/arvindseshan/EV3-Alexa-Quiz-Game/master/flags/{2}.png";
const backgroundImagePath = "https://raw.githubusercontent.com/arvindseshan/EV3-Alexa-Quiz-Game/master/flags/{2}.jpg";

const speechConsCorrect = ['Booya', 'All righty', 'Bam', 'Bazinga', 'Bingo', 'Boom', 'Bravo', 'Cha Ching', 'Cheers', 'Dynomite', 'Hip hip hooray', 'Hurrah', 'Hurray', 'Huzzah', 'Oh dear.  Just kidding.  Hurray', 'Kaboom', 'Kaching', 'Oh snap', 'Phew','Righto', 'Way to go', 'Well done', 'Whee', 'Woo hoo', 'Yay', 'Wowza', 'Yowsa'];
const speechConsWrong = ['Argh', 'Aw man', 'Blarg', 'Blast', 'Boo', 'Bummer', 'Darn', "D'oh", 'Dun dun dun', 'Eek', 'Honk', 'Le sigh', 'Mamma mia', 'Oh boy', 'Oh dear', 'Oof', 'Ouch', 'Ruh roh', 'Shucks', 'Uh oh', 'Wah wah', 'Whoops a daisy', 'Yikes'];
const data = [
{CountryName: 'Republic of Albania', Abbreviation: 'al', Capital: 'Tirana'},
{CountryName: 'People\'s Democratic Republic of Algeria', Abbreviation: 'dz', Capital: 'Algiers'},
{CountryName: 'Principality of Andorra', Abbreviation: 'ad', Capital: 'Andorra la Vella'},
{CountryName: 'Republic of Angola', Abbreviation: 'ao', Capital: 'Luanda'},
{CountryName: 'Argentine Republic', Abbreviation: 'ar', Capital: 'Buenos Aires'},
{CountryName: 'Republic of Armenia', Abbreviation: 'am', Capital: 'Yerevan'},
{CountryName: 'Republic of Austria', Abbreviation: 'at', Capital: 'Vienna'},
{CountryName: 'Republic of Azerbaijan', Abbreviation: 'az', Capital: 'Baku'},
{CountryName: 'Commonwealth of the Bahamas', Abbreviation: 'bs', Capital: 'Nassau'},
{CountryName: 'Kingdom of Bahrain', Abbreviation: 'bh', Capital: 'Manama'},
{CountryName: 'People\'s Republic of Bangladesh', Abbreviation: 'bd', Capital: 'Dhaka'},
{CountryName: 'Republic of Belarus', Abbreviation: 'by', Capital: 'Minsk'},
{CountryName: 'Kingdom of Belgium', Abbreviation: 'be', Capital: 'Brussels'},
{CountryName: 'Republic of Benin', Abbreviation: 'bj', Capital: 'Porto-Novo'},
{CountryName: 'Kingdom of Bhutan', Abbreviation: 'bt', Capital: 'Thimphu'},
{CountryName: 'Republic of Bosnia and Herzegovina', Abbreviation: 'ba', Capital: 'Sarajevo'},
{CountryName: 'Republic of Botswana', Abbreviation: 'bw', Capital: 'Gaborone'},
{CountryName: 'Federative Republic of Brazil', Abbreviation: 'br', Capital: 'Brasilia'},
{CountryName: 'Republic of Bulgaria', Abbreviation: 'bg', Capital: 'Sofia'},
{CountryName: 'Kingdom of Cambodia', Abbreviation: 'kh', Capital: 'Phnom Penh'},
{CountryName: 'Republic of Cameroon', Abbreviation: 'cm', Capital: 'Yaounde'},
{CountryName: 'Republic of Chad', Abbreviation: 'td', Capital: 'N\'Djamena'},
{CountryName: 'Republic of Chile', Abbreviation: 'cl', Capital: 'Santiago'},
{CountryName: 'People\'s Republic of China', Abbreviation: 'cn', Capital: 'Beijing'},
{CountryName: 'Republic of Colombia', Abbreviation: 'co', Capital: 'Bogota'},
{CountryName: 'Union of the Comoros', Abbreviation: 'km', Capital: 'Moroni'},
{CountryName: 'Republic of Costa Rica', Abbreviation: 'cr', Capital: 'San Jose'},
{CountryName: 'Republic of Croatia', Abbreviation: 'hr', Capital: 'Zagreb'},
{CountryName: 'Republic of Cuba', Abbreviation: 'cu', Capital: 'Havana'},
{CountryName: 'Republic of Cyprus', Abbreviation: 'cy', Capital: 'Nicosia'},
{CountryName: 'Czech Republic', Abbreviation: 'cz', Capital: 'Prague'},
{CountryName: 'Kingdom of Denmark', Abbreviation: 'dk', Capital: 'Copenhagen'},
{CountryName: 'Republic of Djibouti', Abbreviation: 'dj', Capital: 'Djibouti'},
{CountryName: 'Commonwealth of Dominica', Abbreviation: 'dm', Capital: 'Roseau'},
{CountryName: 'Republic of Ecuador', Abbreviation: 'ec', Capital: 'Quito'},
{CountryName: 'Arab Republic of Egypt', Abbreviation: 'eg', Capital: 'Cairo'},
{CountryName: 'Republic of El Salvador', Abbreviation: 'sv', Capital: 'San Salvador'},
{CountryName: 'Republic of Equatorial Guinea', Abbreviation: 'gq', Capital: 'Malabo'},
{CountryName: 'the State of Eritrea', Abbreviation: 'er', Capital: 'Asmara'},
{CountryName: 'Republic of Estonia', Abbreviation: 'ee', Capital: 'Tallinn'},
{CountryName: 'Federal Democratic Republic of Ethiopia', Abbreviation: 'et', Capital: 'Addis Ababa'},
{CountryName: 'Republic of Fiji', Abbreviation: 'fj', Capital: 'Suva'},
{CountryName: 'Republic of Finland', Abbreviation: 'fi', Capital: 'Helsinki'},
{CountryName: 'French Republic', Abbreviation: 'fr', Capital: 'Paris'},
{CountryName: 'Gabonese Republic', Abbreviation: 'ga', Capital: 'Libreville'},
{CountryName: 'Republic of the Gambia', Abbreviation: 'gm', Capital: 'Banjul'},
{CountryName: 'Federal Republic of Germany', Abbreviation: 'de', Capital: 'Berlin'},
{CountryName: 'Republic of Ghana', Abbreviation: 'gh', Capital: 'Accra'},
{CountryName: 'Hellenic Republic', Abbreviation: 'gr', Capital: 'Athens'},
{CountryName: 'Republic of Guatemala', Abbreviation: 'gt', Capital: 'Guatemala City'},
{CountryName: 'Republic of Guinea', Abbreviation: 'gn', Capital: 'Conakry'},
{CountryName: 'Republic of Guinea-Bissau', Abbreviation: 'gw', Capital: 'Bissau'},
{CountryName: 'Republic of Guyana', Abbreviation: 'gy', Capital: 'Georgetown'},
{CountryName: 'Republic of Haiti', Abbreviation: 'ht', Capital: 'Port-au-Prince'},
{CountryName: 'Republic of Honduras', Abbreviation: 'hn', Capital: 'Tegucigalpa'},
{CountryName: 'Hungary', Abbreviation: 'hu', Capital: 'Budapest'},
{CountryName: 'Republic of Iceland', Abbreviation: 'is', Capital: 'Reykjavik'},
{CountryName: 'Republic of India', Abbreviation: 'in', Capital: 'New Delhi'},
{CountryName: 'Republic of Indonesia', Abbreviation: 'id', Capital: 'Jakarta'},
{CountryName: 'Islamic Republic of Iran', Abbreviation: 'ir', Capital: 'Tehran'},
{CountryName: 'Republic of Iraq', Abbreviation: 'iq', Capital: 'Baghdad'},
{CountryName: 'State of Israel', Abbreviation: 'il', Capital: 'Jerusalem*'},
{CountryName: 'Italian Republic', Abbreviation: 'it', Capital: 'Rome'},
{CountryName: 'Hashemite Kingdom of Jordan', Abbreviation: 'jo', Capital: 'Amman'},
{CountryName: 'Republic of Kazakhstan', Abbreviation: 'kz', Capital: 'Astana'},
{CountryName: 'Republic of Kenya', Abbreviation: 'ke', Capital: 'Nairobi'},
{CountryName: 'Republic of Kiribati', Abbreviation: 'ki', Capital: 'Tarawa Atoll'},
{CountryName: 'Republic of Serbia', Abbreviation: 'rs', Capital: 'Pristina'},
{CountryName: 'State of Kuwait', Abbreviation: 'kw', Capital: 'Kuwait City'},
{CountryName: 'Kyrgyz Republic', Abbreviation: 'kg', Capital: 'Bishkek'},
{CountryName: 'Republic of Latvia', Abbreviation: 'lv', Capital: 'Riga'},
{CountryName: 'Lebanese Republic', Abbreviation: 'lb', Capital: 'Beirut'},
{CountryName: 'Kingdom of Lesotho', Abbreviation: 'ls', Capital: 'Maseru'},
{CountryName: 'Republic of Liberia', Abbreviation: 'lr', Capital: 'Monrovia'},
{CountryName: 'Libya', Abbreviation: 'ly', Capital: 'Tripoli'},
{CountryName: 'Principality of Liechtenstein', Abbreviation: 'li', Capital: 'Vaduz'},
{CountryName: 'Republic of Lithuania', Abbreviation: 'lt', Capital: 'Vilnius'},
{CountryName: 'Grand Duchy of Luxembourg', Abbreviation: 'lu', Capital: 'Luxembourg'},
{CountryName: 'Republic of North Macedonia', Abbreviation: 'mk', Capital: 'Skopje'},
{CountryName: 'Republic of Madagascar', Abbreviation: 'mg', Capital: 'Antananarivo'},
{CountryName: 'Republic of Malawi', Abbreviation: 'mw', Capital: 'Lilongwe'},
{CountryName: 'Republic of Maldives', Abbreviation: 'mv', Capital: 'Male'},
{CountryName: 'Republic of Mali', Abbreviation: 'ml', Capital: 'Bamako'},
{CountryName: 'Republic of Malta', Abbreviation: 'mt', Capital: 'Valletta'},
{CountryName: 'Republic of the Marshall Islands', Abbreviation: 'mh', Capital: 'Majuro'},
{CountryName: 'Islamic Republic of Mauritania', Abbreviation: 'mr', Capital: 'Nouakchott'},
{CountryName: 'Republic of Mauritius', Abbreviation: 'mu', Capital: 'Port Louis'},
{CountryName: 'United Mexican States', Abbreviation: 'mx', Capital: 'Mexico City'},
{CountryName: 'Federated States of Micronesia', Abbreviation: 'fm', Capital: 'Palikir'},
{CountryName: 'Republic of Moldova', Abbreviation: 'md', Capital: 'Chisinau'},
{CountryName: 'Principality of Monaco', Abbreviation: 'mc', Capital: 'Monaco'},
{CountryName: 'Montenegro', Abbreviation: 'me', Capital: 'Podgorica'},
{CountryName: 'Kingdom of Morocco', Abbreviation: 'ma', Capital: 'Rabat'},
{CountryName: 'Republic of Mozambique', Abbreviation: 'mz', Capital: 'Maputo'},
{CountryName: 'Republic of Namibia', Abbreviation: 'na', Capital: 'Windhoek'},
{CountryName: 'Federal Democratic Republic of Nepal', Abbreviation: 'np', Capital: 'Kathmandu'},
{CountryName: 'Kingdom of the Netherlands', Abbreviation: 'nl', Capital: 'Amsterdam'},
{CountryName: 'Republic of Nicaragua', Abbreviation: 'ni', Capital: 'Managua'},
{CountryName: 'Federal Republic of Nigeria', Abbreviation: 'ng', Capital: 'Niamey'},
{CountryName: 'Federal Republic of Nigeria', Abbreviation: 'ng', Capital: 'Abuja'},
{CountryName: 'Kingdom of Norway', Abbreviation: 'no', Capital: 'Oslo'},
{CountryName: 'Sultanate of Oman', Abbreviation: 'om', Capital: 'Muscat'},
{CountryName: 'Islamic Republic of Pakistan', Abbreviation: 'pk', Capital: 'Islamabad'},
{CountryName: 'Republic of Palau', Abbreviation: 'pw', Capital: 'Melekeok'},
{CountryName: 'Republic of Panama', Abbreviation: 'pa', Capital: 'Panama City'},
{CountryName: 'Independent State of Papua New Guinea', Abbreviation: 'pg', Capital: 'Port Moresby'},
{CountryName: 'Republic of Paraguay', Abbreviation: 'py', Capital: 'Asuncion'},
{CountryName: 'Republic of Peru', Abbreviation: 'pe', Capital: 'Lima'},
{CountryName: 'Republic of the Philippines', Abbreviation: 'ph', Capital: 'Manila'},
{CountryName: 'Republic of Poland', Abbreviation: 'pl', Capital: 'Warsaw'},
{CountryName: 'Portuguese Republic', Abbreviation: 'pt', Capital: 'Lisbon'},
{CountryName: 'State of Qatar', Abbreviation: 'qa', Capital: 'Doha'},
{CountryName: 'Rwandese Republic', Abbreviation: 'rw', Capital: 'Kigali'},
{CountryName: 'Independent State of Samoa', Abbreviation: 'ws', Capital: 'Apia'},
{CountryName: 'Republic of San Marino', Abbreviation: 'sm', Capital: 'San Marino'},
{CountryName: 'Democratic Republic of Sao Tome and Principe', Abbreviation: 'st', Capital: 'Sao Tome'},
{CountryName: 'Kingdom of Saudi Arabia', Abbreviation: 'sa', Capital: 'Riyadh'},
{CountryName: 'Republic of Senegal', Abbreviation: 'sn', Capital: 'Dakar'},
{CountryName: 'Republic of Serbia', Abbreviation: 'rs', Capital: 'Belgrade'},
{CountryName: 'Republic of Seychelles', Abbreviation: 'sc', Capital: 'Victoria'},
{CountryName: 'Republic of Sierra Leone', Abbreviation: 'sl', Capital: 'Freetown'},
{CountryName: 'Republic of Singapore', Abbreviation: 'sg', Capital: 'Singapore'},
{CountryName: 'Slovak Republic', Abbreviation: 'sk', Capital: 'Bratislava'},
{CountryName: 'Republic of Slovenia', Abbreviation: 'si', Capital: 'Ljubljana'},
{CountryName: 'Federal Republic of Somalia', Abbreviation: 'so', Capital: 'Mogadishu'},
{CountryName: 'Republic of South Sudan', Abbreviation: 'ss', Capital: 'Juba'},
{CountryName: 'Kingdom of Spain', Abbreviation: 'es', Capital: 'Madrid'},
{CountryName: 'Republic of the Sudan', Abbreviation: 'sd', Capital: 'Khartoum'},
{CountryName: 'Republic of Suriname', Abbreviation: 'sr', Capital: 'Paramaribo'},
{CountryName: 'Kingdom of Sweden', Abbreviation: 'se', Capital: 'Stockholm'},
{CountryName: 'Swiss Confederation', Abbreviation: 'ch', Capital: 'Bern'},
{CountryName: 'Taiwan, Province of China', Abbreviation: 'tw', Capital: 'Taipei'},
{CountryName: 'Republic of Tajikistan', Abbreviation: 'tj', Capital: 'Dushanbe'},
{CountryName: 'Kingdom of Thailand', Abbreviation: 'th', Capital: 'Bangkok'},
{CountryName: 'Togolese Republic', Abbreviation: 'tg', Capital: 'Lome'},
{CountryName: 'Kingdom of Tonga', Abbreviation: 'to', Capital: 'Nuku\'alofa'},
{CountryName: 'Republic of Trinidad and Tobago', Abbreviation: 'tt', Capital: 'Port-of-Spain'},
{CountryName: 'Republic of Tunisia', Abbreviation: 'tn', Capital: 'Tunis'},
{CountryName: 'Republic of Turkey', Abbreviation: 'tr', Capital: 'Ankara'},
{CountryName: 'Republic of Uganda', Abbreviation: 'ug', Capital: 'Kampala'},
{CountryName: 'United Kingdom of Great Britain and Northern Ireland', Abbreviation: 'gb', Capital: 'London'},
{CountryName: 'United States of America', Abbreviation: 'us', Capital: 'Washington, D.C.'},
{CountryName: 'Eastern Republic of Uruguay', Abbreviation: 'uy', Capital: 'Montevideo'},
{CountryName: 'Republic of Uzbekistan', Abbreviation: 'uz', Capital: 'Tashkent'},
{CountryName: 'Republic of Vanuatu', Abbreviation: 'vu', Capital: 'Port-Vila'},
{CountryName: 'Bolivarian Republic of Venezuela', Abbreviation: 've', Capital: 'Caracas'},
{CountryName: 'Socialist Republic of Viet Nam', Abbreviation: 'vn', Capital: 'Hanoi'},
{CountryName: 'Republic of Yemen', Abbreviation: 'ye', Capital: 'Sanaa'},
{CountryName: 'Republic of Zambia', Abbreviation: 'zm', Capital: 'Lusaka'},
{CountryName: 'Republic of Zimbabwe', Abbreviation: 'zw', Capital: 'Harare'},
{CountryName: 'Plurinational State of Bolivia', Abbreviation: 'bo', Capital: 'La Paz'}
];



const countries = {
  START: `_START`,
  QUIZ: `_QUIZ`,
};

const welcomeMessage = `Welcome to the Country Capitals Quiz Game!  To start a quiz say start quiz?`;
const startQuizMessage = `OK.  I will ask you 5 questions about Country Capitals. `;
const exitSkillMessage = `Thank you for playing the Country Capitals Quiz Game!  Let's play again soon!`;
// const repromptSpeech = `Which other country or capital would you like to know about?`;
const helpMessage = `Would you like to play a capital quiz game with friends? If so, say start quiz`;
const useCardsFlag = true;

/* HELPER FUNCTIONS */

// returns true if the skill is running on a device with a display (show|spot)
function supportsDisplay(handlerInput) {
  var hasDisplay =
    handlerInput.requestEnvelope.context &&
    handlerInput.requestEnvelope.context.System &&
    handlerInput.requestEnvelope.context.System.device &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display
  return hasDisplay;
}

function getBadAnswer(item) {
  return `I'm sorry. ${item} is not something I know very much about in this skill. ${helpMessage}`;
}

function getCurrentScore(score, counter) {
  return `After ${counter} turns, Player 1 has ${score[1]} points. 2 has ${score[2]} points. 3 has ${score[3]} points and Player 4 has ${score[4]} points. <break time="0.5s"/>`;
}

function getFinalScore(score, counter) {
    let winners = []
    let max = Math.max(...score)
    let message = 'Your game is over. '
    console.log("enter final score")

    message += 'The max score was ' + max + '. '
    if (score[1] === max) {
        winners.push("1")
    }
    if (score[2] === max) {
        winners.push("2")
    }
    if (score[3] === max) {
        winners.push("3")
    }
    if (score[4] === max) {
        winners.push("4")
    }
    if (winners.length === 1) {
        message += 'The winner was Player ' + winners.shift() 
    }
    else {
        message += 'The winners were Players '
        while (winners.length > 1) {
            message += winners.shift() + ", "
        }
        message += " and " + winners.shift()
    }
    console.log("exit final score")
    return message
//   return `Your game is over.  Player 1 had ${score[1]}. Player 2 had ${score[2]}. Player 3 had ${score[3]}. Player 4 had ${score[4]}. `;
}

function getCardTitle(item) {
  return item.CountryName;
}

function getSmallImage(item) {
//   return `https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/tutorials/quiz-game/state_flag/720x400/${item.Abbreviation}._TTH_.png`;
  return `https://raw.githubusercontent.com/arvindseshan/EV3-Alexa-Quiz-Game/master/flags/${item.Abbreviation}.png`;

}

function getLargeImage(item) {
//   return `https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/tutorials/quiz-game/state_flag/1200x800/${item.Abbreviation}._TTH_.png`;
    return `https://raw.githubusercontent.com/arvindseshan/EV3-Alexa-Quiz-Game/master/flags/${item.Abbreviation}.png`;
}

function getImage(height, width, label) {
  return imagePath.replace("{0}", height)
    .replace("{1}", width)
    .replace("{2}", label);
}

function getBackgroundImage(label, height = 1024, width = 600) {
//   return("https://raw.githubusercontent.com/arvindseshan/EV3-Alexa-Quiz-Game/master/flags/us.png")
//   return("https://m.media-amazon.com/images/G/01/mobile-apps/dex/alexa/alexa-skills-kit/tutorials/quiz-game/state_flag/1024x600/NY._TTH_.png")
  
  return backgroundImagePath.replace("{0}", height)
    .replace("{1}", width)
    .replace("{2}", label);
}

function getSpeechDescription(item) {
//   return `${item.StateName} is the ${item.StatehoodOrder} country, admitted to the Union in ${item.StatehoodYear}.  The capital of ${item.StateName} is ${item.Capital}, and the abbreviation for ${item.StateName} is <break strength='strong'/><say-as interpret-as='spell-out'>${item.Abbreviation}</say-as>.  I've added ${item.StateName} to your Alexa app.  Which other country or capital would you like to know about?`;
  return `${item.Capital} is the capital of ${item.CountryName} country. The two-letter country code for ${item.CountryName} is <break strength='strong'/><say-as interpret-as='spell-out'>${item.Abbreviation}</say-as>. Which other country or capital would you like to know about?`;
}

function formatCasing(key) {
  return key.split(/(?=[A-Z])/).join(' ');
}

function getQuestion(counter, property, item) {
  return `Here is your ${counter}th question.  What is the ${formatCasing(property)} of ${item.CountryName}?`;
}

// getQuestionWithoutOrdinal returns the question without the ordinal and is
// used for the echo show.
function getQuestionWithoutOrdinal(property, item) {
  return "What is the " + formatCasing(property).toLowerCase() + " of "  + item.CountryName + "?";
}

function getAnswer(property, item) {
  switch (property) {
    case 'Abbreviation':
      return `The ${formatCasing(property)} of ${item.CountryName} is <say-as interpret-as='spell-out'>${item[property]}</say-as>. `;
    default:
      return `The ${formatCasing(property)} of ${item.CountryName} is ${item[property]}. `;
  }
}

function getRandom(min, max) {
  return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

function askQuestion(handlerInput) {
  console.log("I am in askQuestion()");
  //GENERATING THE RANDOM QUESTION FROM DATA
  const random = getRandom(0, data.length - 1);
  const item = data[random];
  const propertyArray = Object.getOwnPropertyNames(item);
  const property = propertyArray[propertyArray.length - 1];
//   const property = propertyArray[getRandom(1, propertyArray.length - 1)];

  //GET SESSION ATTRIBUTES
  const attributes = handlerInput.attributesManager.getSessionAttributes();

  //SET QUESTION DATA TO ATTRIBUTES
  attributes.selectedItemIndex = random;
  attributes.quizItem = item;
  attributes.quizProperty = property;
  attributes.counter += 1;

  //SAVE ATTRIBUTES
  handlerInput.attributesManager.setSessionAttributes(attributes);

  const question = getQuestion(attributes.counter, property, item);
  return question;
}

function compareSlots(slots, value) {
  for (const slot in slots) {
    if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
      if (slots[slot].value.toString().toLowerCase() === value.toString().toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

function getItem(slots) {
  const propertyArray = Object.getOwnPropertyNames(data[0]);
  let slotValue;

  for (const slot in slots) {
    if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
      slotValue = slots[slot].value;
      for (const property in propertyArray) {
        if (Object.prototype.hasOwnProperty.call(propertyArray, property)) {
          const item = data.filter(x => x[propertyArray[property]]
            .toString().toLowerCase() === slots[slot].value.toString().toLowerCase());
          if (item.length > 0) {
            return item[0];
          }
        }
      }
    }
  }
  return slotValue;
}

function getSpeechCon(type) {
  if (type) return `<say-as interpret-as='interjection'>${speechConsCorrect[getRandom(0, speechConsCorrect.length - 1)]}! </say-as><break strength='strong'/>`;
  return `<say-as interpret-as='interjection'>${speechConsWrong[getRandom(0, speechConsWrong.length - 1)]} </say-as><break strength='strong'/>`;
}


function getTextDescription(item) {
  let text = '';

  for (const key in item) {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      text += `${formatCasing(key)}: ${item[key]}\n`;
    }
  }
  return text;
}

function getAndShuffleMultipleChoiceAnswers(currentIndex, item, property) {
  return shuffle(getMultipleChoiceAnswers(currentIndex, item, property));
}

// This function randomly chooses 3 answers 2 incorrect and 1 correct answer to
// display on the screen using the ListTemplate. It ensures that the list is unique.
function getMultipleChoiceAnswers(currentIndex, item, property) {

  // insert the correct answer first
  let answerList = [item[property]];

  // There's a possibility that we might get duplicate answers
  // 8 states were founded in 1788
  // 4 states were founded in 1889
  // 3 states were founded in 1787
  // to prevent duplicates we need avoid index collisions and take a sample of
  // 8 + 4 + 1 = 13 answers (it's not 8+4+3 because later we take the unique
  // we only need the minimum.)
  let count = 0
  let upperBound = 12

  let seen = new Array();
  seen[currentIndex] = 1;

  while (count < upperBound) {
    let random = getRandom(0, data.length - 1);

    // only add if we haven't seen this index
    if ( seen[random] === undefined ) {
      answerList.push(data[random][property]);
      count++;
    }
  }

  // remove duplicates from the list.
  answerList = answerList.filter((v, i, a) => a.indexOf(v) === i)
  // take the first three items from the list.
  answerList = answerList.slice(0, 3);
  return answerList;
}

// This function takes the contents of an array and randomly shuffles it.
function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  while ( 0 !== currentIndex ) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

/* LAMBDA SETUP */
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    QuizHandler,
    QuizAnswerHandler,
    RepeatHandler,
    HelpHandler,
    ExitHandler,
    SessionEndedRequestHandler,
    EventsReceivedRequestHandler,
    ExpiredRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
