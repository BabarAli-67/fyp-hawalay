import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';

const WALLET_PREVIEW =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBRwjXzHZ7-eO69Sg21TaYgOH6J5PyqWei5NoN2B6voj6LklIfYMKDH-AlcLReym63jrOuXoEMx4PWxFcU7K6TXuWbNU9MSc9ULrM-3KGaphAav9W5KoNvjYdOwb8hMqGBgA5LT-JxozyW1_ZSOkSFIrpxbu2AxCll6epuGFE5GmJOUPUpNUsrd4aqnufncQall2HFaT4rlVaK7oCyJaAZhIoYeaROnOd-QqzYmwAZ1ur4f8CS05zUm0JJG3MMPevv1mBaR3y0K304';

const MAP_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDjp2Pdy9KVn4LGMq2fCD5yMyxBnAsmOuYlR2M5UnKwbFqtRV0-5qR6ulJFVGNJ0iD4nfbNW4VUE34OConZZ0rsF_Q4MnoJHoXX-Qk9HLBgnCo4lxrQyNQAGXr1V7vgI2tMvRgZoSMcIyT3o4IZV7i1rABWEfhRhYSb_kDwIiZ-SUV42ePln6Ny4dk6QvRwpnlc6qLnyPTt2ziqkuNYJqAlMPSAvUvwLplfblfmSPUwD4g5UleYDcwkhob6lNzQDvDCWSFhblwVGiE';

const CATEGORIES = [
  { value: 'wallet', label: 'Wallet' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'keys', label: 'Keys' },
  { value: 'pets', label: 'Pets' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'other', label: 'Other' },
];

/**
 * report_lost_item.html — stepper, composite form, map, sticky footer (mock submit only).
 */
export default function ReportPage() {
  const formId = useId();
  const [reportType, setReportType] = useState('lost');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('electronics');
  const [locationName, setLocationName] = useState('');
  const [date, setDate] = useState('2026-05-14');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState(WALLET_PREVIEW);
  const [fileName, setFileName] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    console.log({
      reportType,
      title,
      category,
      locationName,
      date,
      description,
      imageFileName: fileName,
    });
  }

  const heading = reportType === 'lost' ? 'Report Lost Item' : 'Report Found Item';

  return (
    <div className="bg-background text-on-background min-h-screen pb-32">
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-margin-mobile h-16 bg-surface/70 backdrop-blur-lg shadow-sm">
        <Link to="/dashboard" className="active:scale-95 transition-transform duration-200" aria-label="Close">
          <span className="material-symbols-outlined text-on-surface-variant">close</span>
        </Link>
        <h1 className="font-h2 text-h2 font-bold text-primary">EthicalFinder</h1>
        <div className="w-6" />
      </header>

      <form id={formId} onSubmit={handleSubmit} className="pt-24 px-margin-mobile space-y-xl max-w-2xl mx-auto">
        <div className="mb-lg">
          <div className="flex items-center justify-between px-2 mb-xs">
            <span className="text-label-sm font-label-sm text-primary uppercase tracking-widest">Step 1 of 1</span>
            <span className="text-label-sm font-label-sm text-on-surface-variant">Details</span>
          </div>
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-full rounded-full transition-all duration-500" />
          </div>
        </div>

        <section>
          <h2 className="font-h1 text-h1 text-on-surface mb-xs">{heading}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Provide as much detail as possible to help our ethical community assist you.
          </p>
        </section>

        <div className="space-y-sm">
          <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
            Report type
          </span>
          <div className="flex rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low">
            <button
              type="button"
              onClick={() => setReportType('lost')}
              className={`flex-1 py-sm font-label-sm transition-colors ${
                reportType === 'lost'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Lost
            </button>
            <button
              type="button"
              onClick={() => setReportType('found')}
              className={`flex-1 py-sm font-label-sm transition-colors ${
                reportType === 'found'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              Found
            </button>
          </div>
        </div>

        <div className="space-y-lg">
          <div className="relative">
            <input
              className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
              id={`${formId}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=" "
              autoComplete="off"
            />
            <label
              className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
              htmlFor={`${formId}-title`}
            >
              Title
            </label>
          </div>

          <div className="space-y-sm">
            <label
              className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider"
              htmlFor={`${formId}-category`}
            >
              Category
            </label>
            <select
              id={`${formId}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-14 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none font-body-md"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative group">
            <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm border-2 border-primary-container">
              <img alt="" className="w-full h-full object-cover" src={previewUrl} />
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="bg-surface text-primary px-lg py-sm rounded-full font-label-sm flex items-center gap-xs shadow-lg">
                  <span className="material-symbols-outlined">edit</span>
                  Change Photo
                </span>
              </div>
            </div>
            <label className="absolute inset-0 cursor-pointer rounded-xl" htmlFor={`${formId}-photo`}>
              <span className="sr-only">Upload image</span>
            </label>
            <input
              id={`${formId}-photo`}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImageChange}
            />
            <div className="absolute -bottom-3 -right-3 bg-primary text-on-primary p-xs rounded-full shadow-lg pointer-events-none">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-md">
            <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
              AI suggested caption
            </p>
            <p className="font-body-md text-on-surface mt-sm">Caption will appear here after image upload</p>
          </div>

          <div className="space-y-sm">
            <label className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
              Location
            </label>
            <div className="relative w-full h-48 rounded-xl overflow-hidden shadow-sm border border-outline-variant">
              <img alt="" className="w-full h-full object-cover" src={MAP_IMG} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center animate-pulse">
                  <span
                    className="material-symbols-outlined text-primary text-[40px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    location_on
                  </span>
                </div>
              </div>
              <div className="absolute bottom-md left-md right-md">
                <div className="bg-surface/90 backdrop-blur-md p-md rounded-lg shadow-xl flex items-center gap-md">
                  <span className="material-symbols-outlined text-primary">my_location</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-label-sm font-bold text-on-surface leading-none truncate">
                      {locationName.trim() || 'Location name'}
                    </p>
                    <p className="text-caption text-on-surface-variant">Tap fields below to edit</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <input
                className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
                id={`${formId}-location`}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder=" "
                autoComplete="street-address"
              />
              <label
                className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
                htmlFor={`${formId}-location`}
              >
                Location name
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-lg">
            <div className="relative">
              <input
                className="peer w-full h-14 pt-4 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none"
                id={`${formId}-date`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <label
                className="absolute left-md top-1 text-caption text-primary transition-all"
                htmlFor={`${formId}-date`}
              >
                {reportType === 'lost' ? 'Date lost' : 'Date found'}
              </label>
            </div>
            <div className="relative">
              <textarea
                className="peer w-full pt-6 px-md bg-surface-container-low border-b-2 border-outline-variant focus:border-primary text-on-surface rounded-t-lg transition-all outline-none resize-y min-h-[96px]"
                id={`${formId}-description`}
                placeholder=" "
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <label
                className="absolute left-md top-4 text-body-md text-on-surface-variant peer-focus:top-1 peer-focus:text-caption peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1 peer-[:not(:placeholder-shown)]:text-caption transition-all"
                htmlFor={`${formId}-description`}
              >
                Detailed description
              </label>
            </div>
          </div>
        </div>
      </form>

      <footer className="fixed bottom-0 left-0 w-full bg-surface/80 backdrop-blur-xl px-margin-mobile py-md flex items-center gap-md shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-40">
        <Link
          to="/dashboard"
          className="flex-1 h-14 rounded-xl border border-outline text-on-surface font-label-sm active:scale-95 transition-transform duration-200 flex items-center justify-center"
        >
          Back
        </Link>
        <button
          type="submit"
          form={formId}
          className="flex-[2] h-14 rounded-xl bg-primary text-on-primary font-label-sm shadow-lg active:scale-95 transition-transform duration-200 flex items-center justify-center gap-xs"
        >
          Next Step <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </footer>
    </div>
  );
}
