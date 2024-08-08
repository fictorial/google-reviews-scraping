import { Page } from 'puppeteer';
import { scrollFullPage, scrollPage } from './scrollUtils';
import { PromiseDataType, TransformedObjectRatingType } from '../types/common';

export type Reviews = PromiseDataType<typeof getReviewsFromPage>['reviews'];

export const getReviewsFromPage = async (
  page: Page,
  lastCursor?: string | null
) => {
  const reviews = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(':not(button):not([aria-label])[data-review-id]')
    ).map((el) => {
      const userName = el.querySelector('button[data-review-id][data-href] div:first-child')?.textContent;
      const userAvatarUrl = el.querySelector('button[data-review-id] img')?.getAttribute('src');
      const rating = el.querySelector('span[role="img"][aria-label*=" stars"]')?.getAttribute('aria-label');
      const date = el.querySelector('span[role="img"][aria-label*=" stars"] + span')?.textContent;
      const comment = el.querySelector('div[lang][tabindex]:not([aria-label])')?.textContent;
      // TODO I don't know if this is correct b/c I cannot find any comments that have images...
      const images = Array.from(el.querySelectorAll('div[lang][tabindex] + div img')).map((img) => img.getAttribute('src'));
      const reviewId = el.getAttribute('data-review-id');

      return {
          userName,
          userAvatarUrl,
          rating: parseInt(rating?.split(' ')[0] ?? '0', 10),
          date,
          comment,
          images,
          reviewId
      }
    });
  });

  for (const review of reviews) {
      const { userName, userAvatarUrl, rating, date, comment, images, reviewId } = review;

      console.debug('-----------------------------------------');
      console.debug('reviewId:', reviewId);
      console.debug('userName:', userName);
      console.debug('userAvatarUrl:', userAvatarUrl);
      console.debug('rating:', rating);
      console.debug('date:', date);
      console.debug('comment:', comment);
      console.debug('images:', images);
  }

  const findLastCursor = reviews.findIndex(
    (review) => review?.reviewId === lastCursor
  );
  const removeOldReviews =
    findLastCursor !== -1 ? reviews.slice(0, findLastCursor) : reviews;

  return {
    reviews: removeOldReviews,
    afterCursor: removeOldReviews[0]?.reviewId,
    beforeCursor: lastCursor,
  };
};

export const getAllReviewsFromPage = async (
  page: Page,
  oldBeforeCursor?: string | null
) => {
  let currentCursor = oldBeforeCursor;
  let newBeforeCursor = oldBeforeCursor;

  const accAllReviews: Reviews = [];

  if (!currentCursor) {
    await scrollFullPage(page);

    const { afterCursor, reviews: allReviews } = await getReviewsFromPage(
      page,
      currentCursor
    );

    return { reviews: allReviews, lastCursor: afterCursor };
  }

  do {
    await scrollPage(page);

    const { reviews, afterCursor, beforeCursor } = await getReviewsFromPage(
      page,
      currentCursor
    );

    accAllReviews.push(...reviews);

    currentCursor = afterCursor as string | undefined;

    if (newBeforeCursor) {
      newBeforeCursor = beforeCursor;
    }
  } while (currentCursor);

  return { reviews: accAllReviews, lastCursor: newBeforeCursor };
};

export const getPlaceData = async (page: Page) => {
  const placeData = await page.evaluate(() => {
    const mainContainer = document.querySelector('div[role="main"]');
    const infoContainer = mainContainer?.children[1].children[1].children[0];

    const AllRatingInfoContainer = infoContainer?.children[0];
    const averageInfoContainer = infoContainer?.children[1];

    const rating = Array.from(
      AllRatingInfoContainer?.querySelectorAll('tr') ?? []
    )
      .map((t) => t.getAttribute('aria-label'))
      .filter((r): r is string => r !== null);

    const transformRatingData = rating.reduce(
      (acc: TransformedObjectRatingType, item: string | null) => {
        if (!item) return acc;
        let [starsStr, reviewsStr] = item.split(',');
        const stars = parseInt(starsStr.split(' ')[0]);
        const reviews = parseInt(reviewsStr.match(/\d+/)![0], 10);
        acc[String(stars)] = reviews;
        return acc;
      },
      {}
    );

    return {
      placeName: mainContainer?.getAttribute('aria-label'),
      rating: transformRatingData,
      averageRating: parseFloat(
        averageInfoContainer?.children[0].textContent
          ?.trim()
          .replace(',', '.') ?? '0'
      ),
      totalReviews: parseInt(
        averageInfoContainer?.children[2].textContent
          ?.trim()
          .match(/\d+/)![0] ?? '0',
        10
      ),
    };
  });

  return placeData;
};
