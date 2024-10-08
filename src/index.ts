import { launchBrowser } from './puppeteer/puppeteerSetup';
import {
  getAllReviewsFromPage,
  getPlaceData,
} from './puppeteer/dataExtraction';
import { LocalPlaceInfoParams, LocalPlaceReviewsParams } from './types';
import { RatingSchema, ReviewsSchemaResponse } from './types/schema';
import { ZodError } from 'zod';
import { ReviewsType, LocalPlaceInfoType } from './types/common';

/**
 * Fetches reviews from a specified local place on Google Maps.
 *
 * @param placeUrl - The URL of the reviews page for the local place on Google Maps.
 *   It should be navigated directly to the reviews section/tab.
 * @param options - Options for fetching reviews.
 *   - `navigationTimeout` (optional): The maximum time to wait for navigation, in milliseconds. Default is 6000.
 *   - `lastCursor` (optional): A string representing the cursor position for paginated reviews fetching.
 * @returns An object containing the reviews, the count of reviews, and a cursor to the last review.
 *
 * @example
 * const reviewsData = await getLocalPlaceReviews('https://www.google.com.br/maps/place/Starbucks/@-26.9198174,-49.0715915,17z/data=!4m8!3m7!1s0x94df1907d7f5662f:0xf797f04b7b7520c5!8m2!3d-26.9198222!4d-49.0690166!9m1!1b1!16s%2Fg%2F11k3mqtmjl?entry=ttu');
 */
export const getLocalPlaceReviews = async ({
  placeUrl,
  options,
}: LocalPlaceReviewsParams): Promise<ReviewsType> => {
  console.debug('loading',placeUrl)
  const browser = await launchBrowser();
  console.debug('browser launched')

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(options?.navigationTimeout ?? 6000);

  console.debug('goto',placeUrl)
  await page.goto(placeUrl);
  console.debug('setTimeout', 2000)
  await new Promise((r) => setTimeout(r, 2000));

  const orderSelector = "button[aria-label='Sort reviews']";
  const orderButtonSelector = "div[role='menuitemradio'][data-index='1']";

  console.debug('waitForSelector',orderSelector)
  await page.waitForSelector(orderSelector);
  console.debug('click',orderSelector)
  await page.click(orderSelector);

  console.debug('waitForSelector',orderButtonSelector)
  await page.waitForSelector(orderButtonSelector);
  console.debug('click',orderButtonSelector)
  await page.click(orderButtonSelector);

  console.debug('setTimeout', 5000)
  await new Promise((r) => setTimeout(r, 5000));
  console.debug('waitForSelector','.fontBodyMedium')
  await page.waitForSelector('.fontBodyMedium');

  console.debug('waitForSelector', '[role="tablist"]')
  await page.waitForSelector('[role="tablist"]');

  console.debug('$eval', '[role="tablist"]')
  await page.$eval('[role="tablist"]', (tablist) => {
    if (tablist.children.length > 0) {
      const firstChild = tablist.children[1];
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      firstChild.dispatchEvent(clickEvent);
    }
  });

  try {
      console.debug('getAllReviewsFromPage')
    const { lastCursor, reviews } = await getAllReviewsFromPage(
      page,
      options?.lastCursor
    );

    const parsedReviews = ReviewsSchemaResponse.parse({ lastCursor, reviews });

    console.debug('close')
    await browser.close();

    return parsedReviews;
  } catch (err) {
    await browser.close();

    if (err instanceof ZodError) {
      console.error(err.issues);
      throw new Error(
        `Error while trying to parse reviews, maybe the scraper is broken, err: ${err.message}`
      );
    }
    throw err;
  }
};

/**
 * Retrieves information about a local place based on the provided URL.
 *
 * @param placeUrl - The URL of the local place on Google Maps.
 * @param options - Options for fetching information, such as navigation timeout.
 *   - `navigationTimeout` (optional): The maximum time to wait for navigation, in milliseconds. Default is 6000.
 * @returns An object containing the local place information.
 *
 * @example
 * const placeInfo = await getLocalPlaceInfo('https://www.google.com.br/maps/place/Starbucks/@-26.9198174,-49.0715915,17z/data=!4m8!3m7!1s0x94df1907d7f5662f:0xf797f04b7b7520c5!8m2!3d-26.9198222!4d-49.0690166!9m1!1b1!16s%2Fg%2F11k3mqtmjl?entry=ttu');
 */
export const getLocalPlaceInfo = async ({
  placeUrl,
  options,
}: LocalPlaceInfoParams): Promise<LocalPlaceInfoType> => {
  const browser = await launchBrowser();

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(options?.navigationTimeout ?? 6000);
  await page.goto(placeUrl);
  await new Promise((r) => setTimeout(r, 2000));

  await page.waitForSelector('[role="tablist"]');

  await page.$eval('[role="tablist"]', (tablist) => {
    if (tablist.children.length > 0) {
      const firstChild = tablist.children[1];
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
      });
      firstChild.dispatchEvent(clickEvent);
    }
  });

  try {
    const data = await getPlaceData(page);

    const parsedData = RatingSchema.parse(data);

    await browser.close();

    return parsedData;
  } catch (err) {
    await browser.close();
    if (err instanceof ZodError) {
      console.error(err.issues);
      throw new Error(
        `Error while trying to parse place info, maybe the scraper is broken, err: ${err.message}`
      );
    }

    throw err;
  }
};
