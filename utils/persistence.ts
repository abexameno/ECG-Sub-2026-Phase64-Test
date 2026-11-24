import { debounce } from 'lodash'; // Wait, do I have lodash? I should check package.json

const save = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
};

export const debouncedSave = debounce(save, 500);
