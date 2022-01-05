import { restore, setupSMTP, cypressWaitAll } from "__support__/e2e/cypress";
import { USERS } from "__support__/e2e/cypress_data";
import { SAMPLE_DATASET } from "__support__/e2e/cypress_sample_dataset";

const { ORDERS_ID, ORDERS, PRODUCTS } = SAMPLE_DATASET;

const { admin } = USERS;

const visualizationTypes = ["line", "area", "bar", "combo"];

const createQuestionAndAddToDashboard = (query, dashboardId) => {
  return cy.createQuestion(query).then(response => {
    cy.request("POST", `/api/dashboard/${dashboardId}/cards`, {
      cardId: response.body.id,
    });
  });
};

const createOneDimensionTwoMetricsQuestion = (display, dashboardId) => {
  return createQuestionAndAddToDashboard(
    {
      name: `${display} one dimension two metrics`,
      query: {
        "source-table": ORDERS_ID,
        aggregation: [["count"], ["avg", ["field", ORDERS.TOTAL, null]]],
        breakout: [["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }]],
      },
      visualization_settings: {
        "graph.dimensions": ["CREATED_AT"],
        "graph.metrics": ["count", "avg"],
      },
      display: display,
      database: 1,
    },
    dashboardId,
  );
};

const createOneMetricTwoDimensionsQuestion = (display, dashboardId) => {
  return createQuestionAndAddToDashboard(
    {
      name: `${display} one metric two dimensions`,
      query: {
        "source-table": ORDERS_ID,
        aggregation: [["count"]],
        breakout: [
          ["field", ORDERS.CREATED_AT, { "temporal-unit": "month" }],
          ["field", PRODUCTS.CATEGORY, { "source-field": ORDERS.PRODUCT_ID }],
        ],
      },
      visualization_settings: {
        "graph.dimensions": ["CREATED_AT", "CATEGORY"],
        "graph.metrics": ["count"],
      },
      display: display,
      database: 1,
    },
    dashboardId,
  );
};

const openEmailPage = emailSubject => {
  cy.window().then(win => (win.location.href = "http://localhost"));
  cy.findByText(emailSubject).click();

  return cy.hash().then(path => {
    const htmlPath = `http://localhost${path.slice(1)}/html`;
    cy.window().then(win => (win.location.href = htmlPath));
    cy.findByText(emailSubject);
  });
};

describe("static visualizations", () => {
  beforeEach(() => {
    restore();
    cy.signInAsAdmin();
    setupSMTP();
  });

  visualizationTypes.map(type => {
    it(`${type} chart`, () => {
      cy.createDashboard()
        .then(({ body: { id: dashboardId } }) => {
          return cypressWaitAll(
            createOneMetricTwoDimensionsQuestion(type, dashboardId),
            createOneDimensionTwoMetricsQuestion(type, dashboardId),
          ).then(() => {
            cy.visit(`/dashboard/${dashboardId}`);
          });
        })
        .then(() => {
          cy.icon("share").click();
          cy.findByText("Dashboard subscriptions").click();

          cy.findByText("Email it").click();
          cy.findByPlaceholderText("Enter user names or email addresses")
            .click()
            .type(`${admin.first_name} ${admin.last_name}{enter}`)
            .blur();

          cy.button("Send email now").click();
          cy.button("Email sent");

          openEmailPage("Test Dashboard").then(() => {
            cy.percySnapshot();
          });
        });
    });
  });
});
