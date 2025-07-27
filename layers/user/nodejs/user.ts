export interface UserData {
    email: string;
    username: string;
    birthday: string;
    favoriteAnt: string;
    country: string;
    antsLevel: string;
    realName?: string;
    description: string;
    imagePath: string;
    timestamp: number;
}

export function isValidStringLength(str: string): boolean {
    return str.length >= 2 && str.length <= 60;
}

export function isValidDate(dateStr: string): boolean {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

    if (!dateStr.match(regex)) {
        return false;
    }

    const [day, month, year] = dateStr.split('/').map(Number);

    const date = new Date(year, month - 1, day);

    return date.getDate() === day && 
           date.getMonth() === month - 1 && 
           date.getFullYear() === year;
}