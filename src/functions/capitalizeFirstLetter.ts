
/**
 * Capitalizes first letter
 * @param str 
 * @returns string 
 */
export default function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}
