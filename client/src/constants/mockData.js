/**
 * Hardcoded placeholder data for Stitch → React UI verification (no backend).
 */

export const MOCK_USER = {
  name: 'Sarah',
  avatarUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBttMWABhGE4-jximptnOPRamLgewlBHcva3IWtdh8TwTQdWRIXvemh_p3K7Pe4AAkUMsB7V63aNz5eQOTr4d1SKxYQ6fwO7EWCa3wUVR06iZKTJWq7QzbHGpGk7HpN9Odvfikl8Jl8zIJD27hDWWm3iaT7EuC3_c4mE35DH9FEtFTqJPpatfyIuSSClxlLEtC75GO4NXRU8RcmhrUDQhGNA2oMYl-zvlvy9jFLv5qAUB21hl8r1sRus0dr88tSKhteB2_JR-5kJYI',
};

export const MOCK_UNREAD_NOTIFICATIONS = 2;

export const MOCK_MATCHES = [
  {
    _id: 'm1',
    similarityScore: 0.91,
    title: 'Samsung Galaxy',
    category: 'Electronics',
    locationName: 'Gulberg',
    date: '2026-05-01',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAMEsvm9H4Jh0SDHrnzqiz3qLcvZFYFC4sVBS9A8yISY4jMdY4jd5Ish2_p6cKCLCdkziSJuaImgy1hTrV5TmYzakuHUo7I3f32v7ISsObJZ1Viq3IcrQO-qwIdVivFtLgi-ETNZXI4IHykDniRVSxVpimRIeTf9OZ0MXlgHxCLauymACht5sPLWBIk7-43wYmD6jfjQb9OWsv33f6dk0hLN28VXcWu9D1bJ365k3pJdY_xZVlU_snTkfNmth5X-eNjsGw_RKchtYk',
  },
];

export const CHAT_PEER_AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCWmzIMS5HAhtt7rmB7BJOFxbzwHY2YQfhwbgaK8qSnWjv-eaJp4-7WI5ig9RkALdpb4mgZXjjtX-97Gcep3wZ1TRWwlB19u26bTop1-NGXRmFsHWyOW1YMCSq8fMPaB1ZNinM52edDF3yTTXrH0pn7SrHbkDcbF4M3JzOGgarIO1YfkCcbQUibmrzQPwKsvFL2m5aEbDoFNTk-3aQ6S2OJr4HCFjNSa9cxlNeE116JovEvaqjoNk9aF4dop9l5AIGFIakZkeScBCs';

export const MOCK_CHAT_MESSAGES = [
  {
    _id: 'msg1',
    senderId: 'me',
    text: 'Is this your phone?',
    createdAt: new Date('2026-05-14T10:00:00'),
  },
  {
    _id: 'msg2',
    senderId: 'other',
    text: 'Yes! Where did you find it?',
    createdAt: new Date('2026-05-14T10:01:00'),
  },
];

/** Sample rows for `ItemCard` demos / future dashboard wiring */
export const MOCK_DASHBOARD_ITEMS = [
  {
    _id: '1',
    title: 'Black Samsung Phone',
    reportType: 'lost',
    category: 'Electronics',
    locationName: 'Gulberg, Lahore',
    date: '2026-05-01',
    status: 'active',
    imageUrl: null,
  },
  {
    _id: '2',
    title: 'Blue Wallet',
    reportType: 'found',
    category: 'Accessories',
    locationName: 'DHA, Lahore',
    date: '2026-05-03',
    status: 'active',
    imageUrl: null,
  },
];
