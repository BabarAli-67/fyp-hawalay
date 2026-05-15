import { ToastContainer as ReactToastifyContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/** report_lost_item.html — inner toast row classes */
export const STITCH_TOAST_CLASSNAME =
  'bg-inverse-surface text-inverse-on-surface p-md rounded-xl shadow-2xl flex items-center gap-md';

/**
 * Wraps react-toastify with Stitch toast surface classes.
 * Use `import { toast } from 'react-toastify'` in app code to fire toasts.
 */
export function Toast({ containerClassName = '', ...rest }) {
  return (
    <ReactToastifyContainer
      position="top-center"
      autoClose={5000}
      hideProgressBar
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable={false}
      limit={3}
      toastClassName={STITCH_TOAST_CLASSNAME}
      bodyClassName="font-body-md p-0 m-0"
      containerClassName={containerClassName}
      {...rest}
    />
  );
}
